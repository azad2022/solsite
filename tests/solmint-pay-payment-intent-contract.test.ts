import assert from 'node:assert/strict';
import test from 'node:test';
import { createPayPaymentIntentService } from '../src/pay/payment-intent-service';
import { PayHttpClient, PayHttpError } from '../src/pay/http';

const INTENT_ID = '11111111-1111-4111-8111-111111111111';

function payload(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    apiVersion: 'v1',
    data: {
      id: INTENT_ID,
      merchant: { id: '22222222-2222-4222-8222-222222222222', businessName: 'SolMint Demo' },
      amountAtomic: '123456789',
      asset: 'SOL',
      tokenMint: null,
      tokenProgram: null,
      tokenDecimals: null,
      recipient: '11111111111111111111111111111111',
      reference: 'REF12345678901234567890123456789012',
      feeBps: 100,
      feePayer: 'customer',
      feeAtomic: '1234567',
      gasSponsored: false,
      status: 'verifying',
      expiresAt: '2026-09-06T14:00:00.000Z',
      customerTotalAtomic: '124691356',
      network: 'solana',
      verificationCommitment: 'finalized',
      ...overrides,
    },
  };
}

test('typed Payment Intent service preserves atomic precision and rejects malformed contracts', async () => {
  let requestedPath = '';
  const fetchImpl: typeof fetch = async (input) => {
    requestedPath = String(input);
    return new Response(JSON.stringify(payload()), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const service = createPayPaymentIntentService(new PayHttpClient({ fetchImpl }));
  const intent = await service.get(` ${INTENT_ID} `);

  assert.equal(requestedPath, `/api/pay/v1/payment-intents/${INTENT_ID}`);
  assert.equal(intent.amountAtomic, '123456789');
  assert.equal(intent.customerTotalAtomic, '124691356');
  assert.equal(intent.status, 'verifying');
  assert.equal(intent.verificationCommitment, 'finalized');

  const malformedFetch: typeof fetch = async () => new Response(JSON.stringify({ success: true, apiVersion: 'v1', data: { id: INTENT_ID } }), { status: 200 });
  const malformedService = createPayPaymentIntentService(new PayHttpClient({ fetchImpl: malformedFetch }));
  await assert.rejects(() => malformedService.get(INTENT_ID), TypeError);
});

test('typed Payment Intent service retains HTTP error classification', async () => {
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ success: false, error: { code: 'PAYMENT_INTENT_NOT_FOUND', message: 'not found' } }), { status: 404, headers: { 'x-request-id': 'req-test-404' } });
  const service = createPayPaymentIntentService(new PayHttpClient({ fetchImpl }));

  await assert.rejects(async () => service.get(INTENT_ID), (error: unknown) => {
    assert.ok(error instanceof PayHttpError);
    assert.equal(error.status, 404);
    assert.equal(error.requestId, 'req-test-404');
    return true;
  });
});

test('Payment Intent status union does not turn submitted transactions into success', async () => {
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify(payload({ status: 'detected' })), { status: 200 });
  const service = createPayPaymentIntentService(new PayHttpClient({ fetchImpl }));
  const intent = await service.get(INTENT_ID);

  assert.equal(intent.status, 'detected');
  assert.notEqual(intent.status, 'completed');
  assert.notEqual(intent.status, 'confirmed');
});
