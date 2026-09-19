import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync('functions/api/pay/v1/payment-links.ts', 'utf8');
const service = readFileSync('src/pay/services/paymentLinkService.ts', 'utf8');

test('Payment Link GET uses only released fields and merchant scope', () => {
  assert.match(route, /const SELECT = \[/);
  for (const field of ['id','merchant_id','slug','title','fixed_amount_atomic','asset','fee_payer','checkout_locale','is_active','expires_at','created_at','updated_at']) {
    assert.match(route, new RegExp("['\\\"]" + field + "['\\\"]"));
  }
  assert.match(route, /merchant_id=eq\./);
  assert.match(route, /order=created_at\.desc/);
});

test('Payment Link GET is authenticated and identity-mediated', () => {
  assert.match(route, /resolvePayIdentity\(request, env\)/);
  assert.match(route, /supabaseRequestAsIdentity\(/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('Payment Link service keeps atomic amounts as strings and allowlists optional enums', () => {
  assert.match(service, /!\/\^\\d\+\$\/\.test\(value\)/);
  assert.match(service, /ASSETS/);
  assert.match(service, /PAYERS/);
  assert.match(service, /LOCALES/);
});
