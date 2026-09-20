import assert from 'node:assert/strict';
import test from 'node:test';

test('Customers endpoint contract is tenant-scoped and read-only', async () => {
  const source = await import('../functions/api/pay/v1/customers.ts');
  assert.equal(typeof source.onRequestGet, 'function');

  const code = await import('node:fs').then(({ readFileSync }) => readFileSync('functions/api/pay/v1/customers.ts', 'utf8'));
  assert.match(code, /resolvePayIdentity/);
  assert.match(code, /supabaseRequestAsIdentity/);
  assert.match(code, /pay_customer_projection/);
  assert.doesNotMatch(code, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(code, /fetch\([^)]*rest\/v1\/pay_payment_intents/);
});
