import assert from 'node:assert/strict';
import test from 'node:test';
import { PayHttpClient } from '../src/pay/http';
import { createPayPaymentIntentService } from '../src/pay/payment-intent-service';

const BASE_DATA = {
  id: '11111111-1111-4111-8111-111111111111',
  merchant: { id: '22222222-2222-4222-8222-222222222222', businessName: 'Test Store' },
  amountAtomic: '1000000',
  asset: 'SOL',
  tokenMint: null,
  tokenProgram: null,
  tokenDecimals: null,
  recipient: '11111111111111111111111111111111',
  reference: '11111111111111111111111111111111111111111111',
  feeBps: 100,
  feePayer: 'merchant',
  feeAtomic: '10000',
  gasSponsored: false,
  status: 'created',
  expiresAt: '2099-01-01T00:00:00.000Z',
  customerTotalAtomic: '1000000',
  network: 'solana',
  verificationCommitment: 'finalized',
} as const;

function clientWith(payload: unknown): PayHttpClient {
  return new PayHttpClient({
    fetchImpl: (async () => new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })) as typeof fetch,
  });
}

test('Payment Intent service preserves authoritative atomic snapshot', async () => {
  const service = createPayPaymentIntentService(clientWith({ success: true, apiVersion: 'v1', data: BASE_DATA }));
  const intent = await service.get(BASE_DATA.id);
  assert.equal(intent.id, BASE_DATA.id);
  assert.equal(intent.amountAtomic, '1000000');
  assert.equal(intent.feeAtomic, '10000');
  assert.equal(intent.customerTotalAtomic, '1000000');
  assert.equal(intent.reference, BASE_DATA.reference);
  assert.equal(intent.status, 'created');
  assert.equal(intent.verificationCommitment, 'finalized');
});

test('Payment Intent service rejects floating-point financial values', async () => {
  const service = createPayPaymentIntentService(clientWith({
    success: true,
    apiVersion: 'v1',
    data: { ...BASE_DATA, amountAtomic: 0.001 },
  }));
  await assert.rejects(() => service.get(BASE_DATA.id), TypeError);
});

test('Payment Intent service enforces SOL token-field invariants', async () => {
  const service = createPayPaymentIntentService(clientWith({
    success: true,
    apiVersion: 'v1',
    data: { ...BASE_DATA, tokenDecimals: 9 },
  }));
  await assert.rejects(() => service.get(BASE_DATA.id), TypeError);
});
