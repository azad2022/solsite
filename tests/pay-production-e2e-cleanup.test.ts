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

test('production browser E2E never deletes authoritative payment or ledger evidence', () => {
  for (const evidence of [
    'public.pay_payment_transactions',
    'public.pay_merchant_ledger',
    'public.pay_revenue_ledger',
    'public.pay_commissions',
    'public.pay_gas_ledger',
    'public.pay_payout_batches',
  ]) assert.ok(cleanup.includes(evidence), 'Cleanup must guard ' + evidence);
  assert.match(cleanup, /Refusing E2E cleanup because authoritative transaction\/ledger evidence exists/);
  assert.doesNotMatch(cleanup, /delete from public\.pay_payment_transactions/i);
  assert.doesNotMatch(cleanup, /delete from public\.pay_merchant_ledger/i);
  assert.doesNotMatch(cleanup, /delete from public\.pay_revenue_ledger/i);
});

test('production browser E2E removes blocking non-financial events before parent intents and reports residue', () => {
  const events = cleanup.indexOf('payment events');
  const intents = cleanup.indexOf("'payment intents'");
  const links = cleanup.indexOf("'payment links'");
  const invoices = cleanup.indexOf("'invoices'");
  const merchant = cleanup.indexOf("'merchant'");
  assert.ok(events >= 0 && events < intents, 'Payment event rows must be removed before their restricted parent intents.');
  assert.ok(intents < links && intents < invoices, 'Payment intents must be removed before their linked invoice/payment-link rows.');
  assert.ok(links < merchant && invoices < merchant, 'Linked billing data must be removed before the disposable Merchant.');
  assert.match(cleanup, /PAY_E2E_CLEANUP_FAILED/);
  assert.match(cleanup, /Residual Merchant fixture rows/);
  assert.match(cleanup, /Residual auth fixture rows/);
  assert.doesNotMatch(cleanup, /\.catch\(\(\) => \{\}\)/, 'Cleanup errors must not be silently swallowed.');
});
