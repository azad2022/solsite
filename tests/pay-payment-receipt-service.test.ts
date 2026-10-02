import assert from 'node:assert/strict';
import test from 'node:test';
import { createPayPaymentReceiptService } from '../src/pay/payment-receipt-service';
import type { PayHttpClient } from '../src/pay/http';

const paymentId = '11111111-1111-4111-8111-111111111111';
const merchantId = '22222222-2222-4222-8222-222222222222';
const txId = '33333333-3333-4333-8333-333333333333';
const base = {
  receipt: {
    id: paymentId,
    status: 'completed',
    merchant: { id: merchantId, businessName: 'Test Store' },
    paymentLink: {
      slug: 'solmint-test',
      title: 'Test payment',
      description: 'Pay for your order',
      checkoutLocale: 'en-US',
    },
    amountAtomic: '1000000000',
    customerTotalAtomic: '1010000000',
    merchantSettlementAtomic: '1000000000',
    feeAtomic: '10000000',
    feeBps: 100,
    feePayer: 'customer',
    asset: 'SOL',
    tokenMint: null,
    tokenProgram: null,
    tokenDecimals: null,
    recipient: 'J8sqq3CzmCUAYyRKV8Q16MB9tCoutFyfYFFBKp5xEynf',
    feeRecipient: 'EZTvPLYyjn6TnXqhiFKw59aqgAPHwxV4qUwhHXctNbXV',
    reference: '5aseQbSxeQKPc9bqTyShch1r2CqgsF4eBcDBgE8aurY9',
    network: 'solana',
    verificationCommitment: 'finalized',
    createdAt: '2026-10-02T12:00:00Z',
    completedAt: '2026-10-02T12:01:00Z',
    payerWallet: null,
  },
  transaction: {
    id: txId,
    signature: '5KQwrPbHn1PTfJ8bV2D8X1hW7x2qZQp6Q8Q1dJfK7Yh4wE6M2J8Q1V9D2Q6H8K3',
    slot: 123456,
    blockTime: '2026-10-02T12:01:00Z',
    observedAmountAtomic: '1010000000',
    asset: 'SOL',
    recipient: 'J8sqq3CzmCUAYyRKV8Q16MB9tCoutFyfYFFBKp5xEynf',
    referenceMatched: true,
    confirmed: true,
    commitment: 'finalized',
    feePayer: '11111111111111111111111111111111',
    networkFeeLamports: '5000',
    verificationStatus: 'verified',
    verifiedAt: '2026-10-02T12:01:00Z',
    isAuthoritative: true,
    tokenMint: null,
    tokenProgram: null,
    tokenDecimals: null,
  },
  transfers: [],
};

function client(payload: unknown): PayHttpClient {
  return {
    request: async <T>() => payload as T,
  } as unknown as PayHttpClient;
}

test('payment receipt service parses a completed authoritative receipt', async () => {
  const service = createPayPaymentReceiptService(client({ success: true, apiVersion: 'v1', data: base }));
  const receipt = await service.get(paymentId);
  assert.equal(receipt.id, paymentId);
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.paymentLink?.checkoutLocale, 'en-US');
  assert.equal(receipt.customerTotalAtomic, '1010000000');
  assert.equal(receipt.feeAtomic, '10000000');
  assert.equal(receipt.merchantSettlementAtomic, '1000000000');
  assert.equal(receipt.transaction.isAuthoritative, true);
  assert.equal(receipt.transaction.verificationStatus, 'verified');
});

test('payment receipt service fails closed on malformed transaction signature', async () => {
  const service = createPayPaymentReceiptService(client({
    success: true,
    apiVersion: 'v1',
    data: { ...base, transaction: { ...base.transaction, signature: 'bad' } },
  }));
  await assert.rejects(() => service.get(paymentId), /Invalid payment receipt/);
});

test('payment receipt service rejects a non-completed receipt snapshot', async () => {
  const service = createPayPaymentReceiptService(client({
    success: true,
    apiVersion: 'v1',
    data: { ...base, receipt: { ...base.receipt, status: 'confirmed' } },
  }));
  await assert.rejects(() => service.get(paymentId), /Invalid completed payment receipt/);
});

test('payment receipt service rejects an unsupported receipt locale', async () => {
  const service = createPayPaymentReceiptService(client({
    success: true,
    apiVersion: 'v1',
    data: {
      ...base,
      receipt: {
        ...base.receipt,
        paymentLink: { ...base.receipt.paymentLink, checkoutLocale: 'de-DE' },
      },
    },
  }));
  await assert.rejects(() => service.get(paymentId), /Invalid payment receipt checkout locale/);
});
