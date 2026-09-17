import assert from 'node:assert/strict';
import test from 'node:test';
import { PayHttpClient } from '../src/pay/http';
import { createPayPaymentVerificationService } from '../src/pay/payment-verification-service';

const PAYMENT_ID = '11111111-1111-4111-8111-111111111111';
const SIGNATURE = '1111111111111111111111111111111111111111111111111111111111111111';

function clientWith(payload: unknown, status = 200): PayHttpClient {
  return new PayHttpClient({
    fetchImpl: (async () => new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })) as typeof fetch,
  });
}

test('verification service preserves backend status and checked-signature evidence', async () => {
  const service = createPayPaymentVerificationService(clientWith({
    success: true,
    data: {
      paymentId: PAYMENT_ID,
      status: 'confirmed',
      outcome: 'confirmed',
      signature: SIGNATURE,
      checkedSignatures: [SIGNATURE],
    },
  }));

  const result = await service.verify(PAYMENT_ID, SIGNATURE);
  assert.equal(result.paymentId, PAYMENT_ID);
  assert.equal(result.status, 'confirmed');
  assert.equal(result.outcome, 'confirmed');
  assert.equal(result.signature, SIGNATURE);
  assert.deepEqual(result.checkedSignatures, [SIGNATURE]);
});

test('verification service rejects a backend response that changes the submitted signature', async () => {
  const differentSignature = '2222222222222222222222222222222222222222222222222222222222222222';
  const service = createPayPaymentVerificationService(clientWith({
    success: true,
    data: {
      paymentId: PAYMENT_ID,
      status: 'confirmed',
      outcome: 'confirmed',
      signature: differentSignature,
    },
  }));

  await assert.rejects(() => service.verify(PAYMENT_ID, SIGNATURE), TypeError);
});

test('verification service rejects malformed checked-signature evidence', async () => {
  const service = createPayPaymentVerificationService(clientWith({
    success: true,
    data: {
      paymentId: PAYMENT_ID,
      status: 'ambiguous',
      outcome: 'ambiguous',
      signature: SIGNATURE,
      checkedSignatures: ['not-a-solana-signature'],
    },
  }));

  await assert.rejects(() => service.verify(PAYMENT_ID, SIGNATURE), TypeError);
});

test('verification service validates payment id and transaction signature before network access', async () => {
  let requests = 0;
  const client = new PayHttpClient({
    fetchImpl: (async () => {
      requests += 1;
      return new Response('{}', { status: 200 });
    }) as typeof fetch,
  });
  const service = createPayPaymentVerificationService(client);

  await assert.rejects(() => service.verify('invalid', SIGNATURE), TypeError);
  await assert.rejects(() => service.verify(PAYMENT_ID, 'invalid'), TypeError);
  assert.equal(requests, 0);
});
