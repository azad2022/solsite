import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync('functions/api/pay/v1/payment-links.ts', 'utf8');
const publicRoute = readFileSync('functions/api/pay/v1/payment-links/[slug].ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260927134700_solmint_pay_payment_link_end_to_end.sql', 'utf8');
const mutations = readFileSync('supabase/migrations/20260927150000_solmint_pay_payment_link_mutations.sql', 'utf8');
const openapi = JSON.parse(readFileSync('public/openapi.json', 'utf8'));

test('Payment Link merchant route exposes the real DB fields and creation mutation', () => {
  assert.match(route, /amount_atomic::text/);
  for (const field of ['id','merchant_id','slug','title','description','asset','fee_payer','checkout_locale','is_active','expires_at']) {
    assert.match(route, new RegExp(field === 'description' ? field : "['\\\"]" + field + "['\\\"]"));
  }
  assert.match(route, /pay_create_payment_link/);
  assert.match(route, /resolvePayIdentity\(request, env\)/);
  assert.match(route, /assertIdempotencyKey\(request\)/);
  assert.match(route, /enforcePayRateLimit/);
  assert.match(route, /hashCanonicalRequest/);
  assert.match(route, /supabaseRequestAsIdentity\(/);
  assert.match(route, /resolveAssetFromEnvironment\(asset/);
  assert.match(route, /PAYMENT_LINK_ASSET_NOT_CONFIGURED/);
  assert.match(route, /Origin/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('Public Payment Link route is anonymous GET plus origin-protected checkout creation', () => {
  assert.match(publicRoute, /export const onRequestGet/);
  assert.match(publicRoute, /export const onRequestPost/);
  assert.match(publicRoute, /pay_create_payment_intent_from_link/);
  assert.match(publicRoute, /assertIdempotencyKey\(request\)/);
  assert.match(publicRoute, /PAYMENT_LINK_EXPIRED/);
  assert.match(publicRoute, /PAYMENT_LINK_NOT_CONFIGURED/);
  assert.match(publicRoute, /PAY_APP_ORIGIN/);
  assert.match(publicRoute, /payment-links:checkout/);
  assert.match(publicRoute, /supabaseSecret/);
  assert.doesNotMatch(publicRoute, /authenticateMerchantApi/);
});

test('Payment Link migration binds descriptions and public checkout intents to link ids', () => {
  assert.match(migration, /add column if not exists description text/);
  assert.match(migration, /pay_create_payment_link/);
  assert.match(migration, /payment-links:create/);
  assert.match(migration, /pay_create_payment_intent_from_link/);
  assert.match(migration, /grant execute on function public\.pay_create_payment_intent_from_link[\s\S]*to service_role/);
  assert.match(migration, /search_path = ''/);
});


test('Payment Link mutations are authenticated, idempotent and tenant-scoped', () => {
  assert.match(route, /export const onRequestPatch/);
  assert.match(route, /export const onRequestDelete/);
  assert.match(route, /pay_update_payment_link/);
  assert.match(route, /pay_delete_payment_link/);
  assert.match(route, /payment-links:update:user/);
  assert.match(route, /payment-links:delete:user/);
  assert.match(route, /PAYMENT_LINK_HAS_PAYMENTS/);
  assert.match(route, /PAYMENT_LINK_SLUG_EXISTS/);
  assert.match(route, /Origin/);
  assert.match(route, /resolvePayIdentity\(request, env\)/);
  assert.match(route, /supabaseRequestAsIdentity\(/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('Payment Link mutation DB contract preserves payment history and client execution boundaries', () => {
  assert.match(mutations, /create or replace function public\.pay_update_payment_link/);
  assert.match(mutations, /create or replace function public\.pay_delete_payment_link/);
  assert.match(mutations, /payment-links:update/);
  assert.match(mutations, /payment-links:delete/);
  assert.match(mutations, /for update/);
  assert.match(mutations, /array\['owner','admin','finance'\]/);
  assert.match(mutations, /payment_link_id=v_link\.id/);
  assert.match(mutations, /state','has_payments/);
  assert.match(mutations, /grant execute on function public\.pay_update_payment_link[\s\S]*to authenticated/);
  assert.match(mutations, /grant execute on function public\.pay_delete_payment_link[\s\S]*to authenticated/);
  assert.match(mutations, /revoke all on function public\.pay_update_payment_link[\s\S]*from public,anon/);
  assert.match(mutations, /revoke all on function public\.pay_delete_payment_link[\s\S]*from public,anon/);
  assert.match(mutations, /search_path = ''/);
});


test('OpenAPI documents the released Payment Link mutation surface', () => {
  const paymentLinks = openapi.paths['/api/pay/v1/payment-links'];
  assert.equal(paymentLinks?.patch?.operationId, 'updatePayPaymentLink');
  assert.equal(paymentLinks?.delete?.operationId, 'deletePayPaymentLink');
  assert.match(String(paymentLinks?.patch?.description || ''), /Historical Payment Intent snapshots remain unchanged/);
  assert.match(String(paymentLinks?.delete?.description || ''), /deactivate/);
});
