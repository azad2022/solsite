import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const browserE2E = readFileSync('e2e/pay-production-ui.e2e.mjs', 'utf8');
const start = browserE2E.indexOf('async function cleanup(fixture, merchantId) {');
const end = browserE2E.indexOf('\n\nasync function readJson', start);
if (start < 0 || end < 0) throw new Error('Production browser E2E cleanup function is missing.');
const cleanup = browserE2E.slice(start, end);

test('production browser E2E cleanup is constrained to its disposable Merchant fixture', () => {
  assert.match(cleanup, /owner_user_id = \$2/);
  assert.match(cleanup, /business_name = 'SolMint Browser Test Merchant'/);
  assert.match(cleanup, /slug like 'solmint-browser-test-%'/);
  assert.match(cleanup, /Refusing E2E cleanup: the Merchant is not the disposable fixture/);
});

test('production browser E2E never deletes append-only audit or financial evidence', () => {
  for (const evidence of [
    'public.pay_payment_events',
    'public.pay_payment_transactions',
    'public.pay_merchant_ledger',
    'public.pay_revenue_ledger',
    'public.pay_commissions',
    'public.pay_gas_ledger',
    'public.pay_payout_batches',
  ]) assert.ok(cleanup.includes(evidence), 'Cleanup must preflight ' + evidence);
  assert.match(cleanup, /append-only Payment Intent audit history must be preserved/);
  assert.match(cleanup, /Refusing E2E cleanup because authoritative transaction\/ledger evidence exists/);
  assert.doesNotMatch(cleanup, /delete from public\.pay_payment_events/i);
  assert.doesNotMatch(cleanup, /delete from public\.pay_payment_intents/i);
  assert.doesNotMatch(cleanup, /delete from public\.pay_payment_transactions/i);
  assert.doesNotMatch(cleanup, /delete from public\.pay_merchant_ledger/i);
  assert.doesNotMatch(cleanup, /delete from public\.pay_revenue_ledger/i);
});

test('production browser E2E always clears tickets and disables access to fixtures with immutable history', () => {
  assert.match(cleanup, /delete from public\.pay_ticket_messages/);
  assert.match(cleanup, /delete from public\.pay_tickets/);
  assert.match(cleanup, /delete from public\.pay_api_keys/);
  assert.match(cleanup, /update public\.pay_payment_links set is_active = false/);
  assert.match(cleanup, /set status = 'suspended'/);
  assert.match(cleanup, /set role = 'user', is_active = false/);
  assert.match(cleanup, /PAY_E2E_IMMUTABLE_FIXTURE_RETAINED/);
  assert.match(cleanup, /PAY_E2E_INERT_FIXTURE_VERIFIED/);
  assert.match(cleanup, /PAY_E2E_CLEANUP_FAILED/);
  assert.doesNotMatch(cleanup, /\.catch\(\(\) => \{\}\)/, 'Cleanup errors must not be silently swallowed.');
});

test('production browser E2E deletes a Merchant only when it has no Payment Intent or audit history', () => {
  assert.match(cleanup, /retainedForImmutableHistory = Number\(preflight\.intent_count\) > 0 \|\| Number\(preflight\.event_count\) > 0/);
  const retainBranch = cleanup.indexOf("if (retainedForImmutableHistory || protectedEvidence.length > 0)");
  const deleteMerchant = cleanup.indexOf("'Merchant', 'delete from public.pay_merchants");
  assert.ok(retainBranch >= 0 && deleteMerchant > retainBranch);
  assert.match(cleanup, /Unexpected Payment Intent states for disposable fixture/);
  assert.match(cleanup, /Residual E2E access\/support rows/);
});
