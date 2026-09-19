import assert from 'node:assert/strict';
import test from 'node:test';
import { PayHttpClient, PayHttpError } from '../src/pay/http';
import { getMyMerchant } from '../src/pay/services/merchantOnboardingService';

test('merchant onboarding service parses the real merchant envelope', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new PayHttpClient({
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ success: true, merchant: {
        id: 'merchant-1', owner_user_id: 'user-1', business_name: 'Test Store', slug: 'test-store', status: 'pending', created_at: '2026-09-08T00:00:00Z', updated_at: '2026-09-08T00:00:00Z',
      }}), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  });

  const { createMyMerchant } = await import('../src/pay/services/merchantOnboardingService');
  const merchant = await createMyMerchant({ businessName: 'Test Store', slug: 'test-store' }, client);
  assert.equal(merchant.id, 'merchant-1');
  assert.equal(merchant.ownerUserId, 'user-1');
  assert.equal(merchant.status, 'pending');
  assert.equal(calls[0]?.url, '/api/pay/v1/merchants');
  assert.equal(calls[0]?.init?.method, 'POST');
  assert.equal(calls[0]?.init?.credentials, 'include');
  assert.equal(calls[0]?.init?.body, JSON.stringify({ businessName: 'Test Store', slug: 'test-store' }));
});

test('merchant onboarding service parses an authoritative verified receiving wallet', async () => {
  const client = new PayHttpClient({
    fetchImpl: (async () => new Response(JSON.stringify({
      success: true,
      merchant: {
        id: 'merchant-1',
        owner_user_id: 'user-1',
        business_name: 'Test Store',
        slug: 'test-store',
        status: 'active',
        created_at: '2026-09-08T00:00:00Z',
        updated_at: '2026-09-18T00:00:00Z',
        receiving_wallet: {
          id: 'wallet-1',
          address: 'EZTvPLYyjn6TnXqhiFKw59aqgAPHwxV4qUwhHXctNbXV',
          network: 'solana',
          wallet_role: 'receiving',
          is_active: true,
          verification_status: 'verified',
          verified_at: '2026-09-18T00:00:00Z',
        },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch,
  });

  const merchant = await getMyMerchant(client);
  assert.equal(merchant?.receivingWallet?.id, 'wallet-1');
  assert.equal(merchant?.receivingWallet?.address, 'EZTvPLYyjn6TnXqhiFKw59aqgAPHwxV4qUwhHXctNbXV');
  assert.equal(merchant?.receivingWallet?.verificationStatus, 'verified');
  assert.equal(merchant?.receivingWallet?.isActive, true);
});

test('merchant onboarding service rejects malformed receiving wallet snapshots', async () => {
  const client = new PayHttpClient({
    fetchImpl: (async () => new Response(JSON.stringify({
      success: true,
      merchant: {
        id: 'merchant-1',
        owner_user_id: 'user-1',
        business_name: 'Test Store',
        slug: 'test-store',
        status: 'active',
        created_at: '2026-09-08T00:00:00Z',
        updated_at: '2026-09-18T00:00:00Z',
        receiving_wallet: { id: 'wallet-1', address: 'bad', network: 'solana', is_active: false, verification_status: 'verified', verified_at: null },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch,
  });

  await assert.rejects(() => getMyMerchant(client), TypeError);
});

test('Pay HTTP rejects cross-origin and scheme URLs', async () => {
  const client = new PayHttpClient({ fetchImpl: async () => new Response('{}') });
  await assert.rejects(() => client.request('https://example.com/api/pay'), TypeError);
  await assert.rejects(() => client.request('//example.com/api/pay'), TypeError);
});

test('Pay HTTP preserves structured HTTP failures', async () => {
  const client = new PayHttpClient({ fetchImpl: async () => new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json', 'x-request-id': 'r-1' } }) });
  await assert.rejects(
    () => client.request('/api/pay/v1/merchants'),
    (error: unknown) => error instanceof PayHttpError && error.status === 401 && error.requestId === 'r-1',
  );
});
