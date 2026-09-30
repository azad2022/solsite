import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const verify = readFileSync('functions/api/pay/v1/payment-intents/[id]/verify.ts', 'utf8');
const email = readFileSync('functions/api/pay/v1/_shared/paymentEmail.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260930073605_solmint_pay_payment_email_delivery_20260930101000.sql', 'utf8');

test('merchant payment notifications are triggered only from authoritative payment outcomes', () => {
  assert.match(verify, /SUCCESS_EMAIL_STATUSES/);
  assert.match(verify, /FAILURE_EMAIL_STATUSES/);
  assert.match(verify, /notifyMerchantPaymentOutcome\(env, row, status, requestId\)/);
  assert.match(verify, /payment\.outcome\.success/);
  assert.match(verify, /payment\.outcome\.failure/);
  assert.match(verify, /pay_claim_payment_email_delivery/);
  assert.match(verify, /pay_complete_payment_email_delivery/);
  assert.match(verify, /pay_fail_payment_email_delivery/);
});

test('merchant notification email uses the configured merchant dashboard locale and Better Auth email server-side', () => {
  assert.match(verify, /default_dashboard_locale/);
  assert.match(verify, /auth_identity_links/);
  assert.match(verify, /solmint_better_auth_adapter/);
  assert.match(verify, /email/);
  assert.match(email, /sendAuthEmail/);
});

test('payment email delivery state is server-only and idempotent per payment outcome', () => {
  assert.match(migration, /unique \(payment_id, event_type\)/);
  assert.match(migration, /payment\.outcome\.success/);
  assert.match(migration, /payment\.outcome\.failure/);
  assert.match(migration, /revoke all on table public\.pay_payment_email_deliveries from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.pay_claim_payment_email_delivery.*to service_role/s);
});
