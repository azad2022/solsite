import assert from 'node:assert/strict';
import test from 'node:test';
import { PayHttpClient } from '../src/pay/http';
import { issueWalletChallenge, verifyWalletChallenge } from '../src/pay/services/merchantOnboardingService';

test('wallet ownership service consumes the real challenge contract', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new PayHttpClient({
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({
        success: true,
        challenge: {
          id: 'challenge-1',
          message: 'SolMint Pay wallet ownership challenge',
          walletAddress: '11111111111111111111111111111111',
          expiresAt: '2026-09-15T17:00:00Z',
        },
      }), { status: 201, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });

  const challenge = await issueWalletChallenge('merchant-1', '11111111111111111111111111111111', client);
  assert.deepEqual(challenge, {
    id: 'challenge-1',
    message: 'SolMint Pay wallet ownership challenge',
    walletAddress: '11111111111111111111111111111111',
    expiresAt: '2026-09-15T17:00:00Z',
  });
  assert.equal(calls[0]?.url, '/api/pay/v1/merchants/merchant-1/wallet-challenges');
  assert.equal(calls[0]?.init?.method, 'POST');
  assert.equal(calls[0]?.init?.credentials, 'include');
  assert.equal(calls[0]?.init?.body, JSON.stringify({ walletAddress: '11111111111111111111111111111111' }));
});

test('wallet ownership service accepts only an authoritative verified response', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new PayHttpClient({
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({
        success: true,
        verified: true,
        merchantId: 'merchant-1',
        walletId: 'wallet-1',
        walletAddress: '11111111111111111111111111111111',
        verifiedAt: '2026-09-15T16:55:00Z',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });

  const result = await verifyWalletChallenge(
    'merchant-1',
    'challenge-1',
    '11111111111111111111111111111111',
    'signed-message-base58',
    client,
  );

  assert.equal(result.verified, true);
  assert.equal(result.walletId, 'wallet-1');
  assert.equal(calls[0]?.url, '/api/pay/v1/merchants/merchant-1/wallet-challenges/challenge-1');
  assert.equal(calls[0]?.init?.method, 'POST');
  assert.equal(calls[0]?.init?.credentials, 'include');
  assert.equal(calls[0]?.init?.body, JSON.stringify({ walletAddress: '11111111111111111111111111111111', signature: 'signed-message-base58' }));
});

test('wallet ownership service rejects mismatched verification responses', async () => {
  const client = new PayHttpClient({
    fetchImpl: (async () => new Response(JSON.stringify({
      success: true,
      verified: true,
      merchantId: 'other-merchant',
      walletId: 'wallet-1',
      walletAddress: '11111111111111111111111111111111',
      verifiedAt: '2026-09-15T16:55:00Z',
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch,
  });

  await assert.rejects(
    () => verifyWalletChallenge('merchant-1', 'challenge-1', '11111111111111111111111111111111', 'signed-message-base58', client),
    TypeError,
  );
});
