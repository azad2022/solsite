import assert from 'node:assert/strict';
import test from 'node:test';
import { createPayTransactionRequestService } from '../src/pay/payment-transaction-request-service';
import { PayHttpClient } from '../src/pay/http';

test('transaction request service consumes the top-level Solana Pay response contract', async () => {
  const transactionBytes = Uint8Array.from([1, 2, 3, 255]);
  let receivedUrl = '';
  let receivedBody = '';

  const client = new PayHttpClient({
    fetchImpl: async (input, init) => {
      receivedUrl = String(input);
      receivedBody = String(init?.body ?? '');
      return new Response(JSON.stringify({
        success: true,
        transaction: btoa(String.fromCharCode(...transactionBytes)),
        message: 'Merchant payment · SOL',
        redirect: 'https://solmint.ir/pay/checkout/test?payment=return',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const service = createPayTransactionRequestService(client);
  const result = await service.build('8f3d4dd1-4ef0-4a4a-9d98-8d9f2a1c9d91', '11111111111111111111111111111111');

  assert.equal(receivedUrl, '/api/pay/v1/payment-intents/8f3d4dd1-4ef0-4a4a-9d98-8d9f2a1c9d91/transaction-request');
  assert.equal(receivedBody, JSON.stringify({ account: '11111111111111111111111111111111' }));
  assert.deepEqual(Array.from(result.transaction), Array.from(transactionBytes));
  assert.equal(result.message, 'Merchant payment · SOL');
  assert.equal(result.redirect, 'https://solmint.ir/pay/checkout/test?payment=return');
});

test('transaction request service rejects a success envelope without transaction', async () => {
  const client = new PayHttpClient({
    fetchImpl: async () => new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  });

  const service = createPayTransactionRequestService(client);
  await assert.rejects(
    () => service.build('8f3d4dd1-4ef0-4a4a-9d98-8d9f2a1c9d91', '11111111111111111111111111111111'),
    /Invalid transaction request field: transaction/,
  );
});
