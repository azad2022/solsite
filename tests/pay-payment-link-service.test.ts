import assert from 'node:assert/strict';
import test from 'node:test';
import { createPayPaymentLinkService } from '../src/pay/services/paymentLinkService';
import type { PayHttpClient } from '../src/pay/http';

const merchantId = '11111111-1111-4111-8111-111111111111';
const linkId = '22222222-2222-4222-8222-222222222222';
const link = {
  id: linkId, merchant_id: merchantId, slug: 'solmint-store', title: 'Store payment',
  description: 'Pay for your order', fixed_amount_atomic: '1000000', asset: 'USDC',
  fee_payer: 'merchant', checkout_locale: 'en-US', is_active: true, expires_at: null,
  created_at: '2026-09-27T00:00:00Z', updated_at: '2026-09-27T00:00:00Z',
};
function clientFor(payload: unknown, capture?: (path: string, init: RequestInit) => void): PayHttpClient {
  return { request: async <T>(path: string, init: RequestInit = {}) => { capture?.(path, init); return payload as T; } } as unknown as PayHttpClient;
}

test('payment link service parses authoritative atomic and description fields', async () => {
  const result = await createPayPaymentLinkService(clientFor({ success:true, apiVersion:'v1', data:[link] })).list(merchantId);
  assert.equal(result[0]?.slug, 'solmint-store');
  assert.equal(result[0]?.description, 'Pay for your order');
  assert.equal(result[0]?.fixed_amount_atomic, '1000000');
  assert.equal(result[0]?.description, 'Pay for your order');
});

test('payment link service rejects non-integer financial data', async () => {
  await assert.rejects(
    () => createPayPaymentLinkService(clientFor({ success:true, apiVersion:'v1', data:[{ ...link, fixed_amount_atomic:'10.5' }] })).list(merchantId),
    /Invalid Pay payment link field: fixed_amount_atomic/,
  );
});

test('payment link service creates through the same-origin API with idempotency', async () => {
  let path = ''; let init: RequestInit | undefined;
  const result = await createPayPaymentLinkService(clientFor({ success:true, apiVersion:'v1', data:[link] }, (p,i) => { path=p; init=i; })).create({
    merchantId,
    slug:'solmint-store',
    title:'Store payment',
    description:'Pay for your order',
    fixedAmountAtomic:'1000000',
    asset:'USDC',
    feePayer:'merchant',
    checkoutLocale:'en-US',
    expiresAt:null,
  }, 'link-create-e2e-key');
  assert.equal(result.id, linkId);
  assert.equal(path, '/api/pay/v1/payment-links');
  assert.equal(init?.method, 'POST');
  assert.equal(new Headers(init?.headers).get('Idempotency-Key'), 'link-create-e2e-key');
});

test('public payment link service creates a Payment Intent only through the public link route', async () => {
  let path = ''; let init: RequestInit | undefined;
  const result = await createPayPaymentLinkService(clientFor({ success:true, apiVersion:'v1', data:{ id:'33333333-3333-4333-8333-333333333333' } }, (p,i) => { path=p; init=i; })).createFromPublic('solmint-store', 'link-checkout-e2e-key');
  assert.equal(result.id, '33333333-3333-4333-8333-333333333333');
  assert.equal(path, '/api/pay/v1/payment-links/solmint-store');
  assert.equal(init?.method, 'POST');
  assert.equal(new Headers(init?.headers).get('Idempotency-Key'), 'link-checkout-e2e-key');
});
