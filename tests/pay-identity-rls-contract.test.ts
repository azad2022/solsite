import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const identityPath = path.join(root, 'functions/api/pay/_shared/identity.ts');
const migrationPath = path.join(root, 'supabase/migrations/20260908000000_solmint_pay_identity_rls_bridge.sql');
const merchantPath = path.join(root, 'functions/api/pay/v1/merchants/index.ts');

function read(file: string): string { return fs.readFileSync(file, 'utf8'); }

test('Pay identity bridge keeps the internal JWT server-side and sends it as the PostgREST Authorization bearer', () => {
  const source = read(identityPath);
  assert.match(source, /mintPayInternalJwt\(env, user\.applicationUserId\)/);
  assert.match(source, /headers\.set\('Authorization', `Bearer \$\{accessToken\}`\)/);
  assert.doesNotMatch(source, /window\.|localStorage|sessionStorage/);
});

test('Pay identity bridge resolves the Better Auth application identity before minting', () => {
  const source = read(identityPath);
  assert.match(source, /getBetterAuthApplicationUser\(request, env\)/);
  assert.match(source, /user\.applicationUserId/);
  assert.match(source, /AUTH_BRIDGE_MISCONFIGURED/);
});

test('merchant GET uses the identity-aware PostgREST path rather than the service-role helper', () => {
  const source = read(merchantPath);
  const getBody = source.slice(source.indexOf('export const onRequestGet'));
  assert.match(getBody, /resolvePayIdentity\(request, env\)/);
  assert.match(getBody, /supabaseRequestAsIdentity\(/);
  assert.doesNotMatch(getBody, /loadMerchant\(env, /);
});

test('RLS migration has fail-closed identity and table-scoped read policies', () => {
  const source = read(migrationPath);
  assert.match(source, /create or replace function public\.pay_request_user_id\(\)/);
  assert.match(source, /security definer\nset search_path = ''/);
  assert.match(source, /current_setting\('role', true\) <> 'authenticated'/);
  assert.match(source, /solmint_user_id/);
  assert.match(source, /create policy pay_merchants_select_member/);
  assert.match(source, /create policy pay_payment_intents_select_member/);
  assert.match(source, /create policy pay_payment_transactions_select_member/);
  assert.match(source, /revoke all on table public\.pay_merchants/);
  assert.match(source, /pay_has_merchant_access\(id\)/);
});

test('sensitive Pay tables remain server-mediated', () => {
  const source = read(migrationPath);
  assert.match(source, /Secrets, API keys, idempotency internals, revenue recognition, webhook payloads,/);
  assert.doesNotMatch(source, /grant select on table[\s\S]*pay_api_keys/);
  assert.doesNotMatch(source, /grant select on table[\s\S]*pay_webhooks/);
  assert.doesNotMatch(source, /grant select on table[\s\S]*pay_webhook_deliveries/);
  assert.doesNotMatch(source, /grant select on table[\s\S]*pay_revenue_ledger/);
});
