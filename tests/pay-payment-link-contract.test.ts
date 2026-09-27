import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync('functions/api/pay/v1/payment-links.ts', 'utf8');
const publicRoute = readFileSync('functions/api/pay/v1/payment-links/[slug].ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260927000100_solmint_pay_payment_link_end_to_end.sql', 'utf8');

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
