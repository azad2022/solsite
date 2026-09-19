import assert from 'node:assert/strict';
import test from 'node:test';
import { createPayPaymentLinkService } from '../src/pay/services/paymentLinkService';
import type { PayHttpClient } from '../src/pay/http';

const merchantId = '11111111-1111-4111-8111-111111111111';
const linkId = '22222222-2222-4222-8222-222222222222';
const link = {
  id: linkId, merchant_id: merchantId, slug: 'pay-store', title: 'Store payment',
  fixed_amount_atomic: '2500000', asset: 'USDC', fee_payer: 'customer', checkout_locale: 'en-US',
  is_active: true, expires_at: null, created_at: '2026-09-19T00:00:00Z', updated_at: '2026-09-19T00:00:00Z',
};

function clientFor(payload: unknown): PayHttpClient {
  return { request: async <T>() => payload as T } as unknown as PayHttpClient;
}

test('payment link service parses the released read envelope', async () => {
  const result = await createPayPaymentLinkService(clientFor({ success:true, apiVersion:'v1', data:[link] })).list(merchantId);
  assert.equal(result[0]?.slug, 'pay-store');
  assert.equal(result[0]?.fixed_amount_atomic, '2500000');
  assert.equal(result[0]?.asset, 'USDC');
});

test('payment link service rejects malformed atomic amounts and enum values', async () => {
  await assert.rejects(
    () => createPayPaymentLinkService(clientFor({ success:true, apiVersion:'v1', data:[{ ...link, fixed_amount_atomic:'2.5' }] })).list(merchantId),
    /Invalid Pay payment link field: fixed_amount_atomic/,
  );
  await assert.rejects(
    () => createPayPaymentLinkService(clientFor({ success:true, apiVersion:'v1', data:[{ ...link, asset:'BTC' }] })).list(merchantId),
    /Invalid Pay payment link field: asset/,
  );
});

test('payment link service validates identifiers and limit before request', async () => {
  const service = createPayPaymentLinkService(clientFor({ success:true, apiVersion:'v1', data:[] }));
  await assert.rejects(() => service.list('bad-id'), /Merchant ID is invalid/);
  await assert.rejects(() => service.list(merchantId, 0), /Payment link limit is invalid/);
});

test('payment link service parses the detail envelope', async () => {
  const result = await createPayPaymentLinkService(clientFor({ success:true, apiVersion:'v1', data:link })).get(merchantId, linkId);
  assert.equal(result.id, linkId);
  assert.equal(result.is_active, true);
});
