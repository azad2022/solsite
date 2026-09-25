import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route=readFileSync('functions/api/pay/v1/invoices.ts','utf8');
const service=readFileSync('src/pay/services/invoiceService.ts','utf8');

test('Invoice GET and POST use the pay_invoices contract',()=>{
  assert.match(route,/const INVOICE_SELECT = \[/);
  for(const field of ['id','merchant_id','invoice_number','customer_label','title','description','amount_atomic','asset','fee_payer','checkout_locale','due_at','status','created_at','updated_at']) assert.match(route,new RegExp(field === 'amount_atomic' ? /amount_atomic::text/ : "['\\\"]"+field+"['\\\"]"));
  assert.match(route,/pay_create_invoice/);
  assert.match(route,/merchant_id=eq\./);
});
test('Invoice creation is session-authenticated, same-origin, rate-limited and idempotent',()=>{
  assert.match(route,/Origin/);
  assert.match(route,/resolvePayIdentity\(request, env\)/);
  assert.match(route,/enforcePayRateLimit/);
  assert.match(route,/assertIdempotencyKey\(request\)/);
  assert.match(route,/hashCanonicalRequest/);
  assert.match(route,/supabaseRequestAsIdentity\(/);
  assert.doesNotMatch(route,/SUPABASE_SERVICE_ROLE_KEY/);
});
test('Invoice financial input remains integer atomic data',()=>{
  assert.match(route,/BigInt\(amountAtomic\)/);
  assert.match(service,/BigInt\(value\)/);
  assert.match(service,/POST/);
  assert.match(service,/Idempotency-Key/);
});
