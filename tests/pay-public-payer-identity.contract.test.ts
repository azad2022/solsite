import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync('functions/api/pay/v1/payment-links/[slug].ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260930100000_solmint_pay_public_payer_identity.sql', 'utf8');

test('public Payment Link requires payer identity and includes it in idempotency request hashing', () => {
  assert.match(route, /body\.firstName/);
  assert.match(route, /body\.lastName/);
  assert.match(route, /body\.paymentReason/);
  assert.match(route, /INVALID_PUBLIC_PAYER_DATA/);
  assert.match(route, /customerFirstName, customerLastName, customerPurpose/);
  assert.match(route, /p_customer_first_name: customerFirstName/);
  assert.match(route, /p_customer_last_name: customerLastName/);
  assert.match(route, /p_customer_purpose: customerPurpose/);
});

test('public payer identity is stored in Payment Intent columns, not the public metadata contract', () => {
  assert.match(migration, /customer_first_name text/);
  assert.match(migration, /customer_last_name text/);
  assert.match(migration, /customer_purpose text/);
  assert.match(migration, /Payment Intent creation/);
  assert.match(migration, /payment_link_id = p_payment_link_id/);
  assert.match(migration, /grant execute on function public\.pay_create_payment_intent_from_link/);
  assert.match(migration, /to service_role/);
  assert.doesNotMatch(route, /customerFirstName[^\n]*p_metadata/);
});


test('public payer contract rejects unexpected request fields', () => {
  assert.match(route, /unexpectedFields/);
  assert.match(route, /Unsupported payer fields were supplied/);
  assert.match(route, /!\['firstName', 'lastName', 'paymentReason'\]\.includes\(key\)/);
});
