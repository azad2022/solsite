import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync('functions/api/pay/v1/invoices.ts', 'utf8');
const service = readFileSync('src/pay/services/invoiceService.ts', 'utf8');

test('Invoice GET uses the released pay_invoices fields and merchant scope', () => {
  assert.match(route, /const INVOICE_SELECT = \[/);
  for (const field of ['id', 'merchant_id', 'invoice_number', 'customer_label', 'title', 'description', 'amount_atomic', 'asset', 'fee_payer', 'checkout_locale', 'due_at', 'status', 'created_at', 'updated_at']) {
    assert.match(route, new RegExp("['\\\"]" + field + "['\\\"]"));
  }
  assert.match(route, /merchant_id=eq\./);
  assert.match(route, /order=created_at\.desc/);
});

test('Invoice GET is authenticated and server-mediated', () => {
  assert.match(route, /resolvePayIdentity\(request, env\)/);
  assert.match(route, /supabaseRequestAsIdentity\(/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('Invoice parser preserves atomic amount strings and allowlists financial enums', () => {
  assert.match(service, /!\/\^\\d\+\$\/\.test\(result\)/);
  assert.match(service, /const UUID = .*\[89ab\]\[0-9a-f\]\{3\}/);
  assert.match(service, /ASSETS/);
  assert.match(service, /PAYERS/);
  assert.match(service, /STATUSES/);
});
