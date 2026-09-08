import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routePath = 'functions/api/pay/v1/payment-intents/[id]/verify.ts';
const route = readFileSync(routePath, 'utf8');

test('Pay verification route uses the authoritative reconciliation engine and DB RPCs', () => {
  assert.match(route, /reconcilePayment/);
  assert.match(route, /pay_apply_verified_observation/);
  assert.match(route, /pay_record_rejected_observation/);
  assert.match(route, /pay_transition_payment/);
  assert.match(route, /enforcePayRateLimit/);
  assert.match(route, /SOLANA_RPC_URL/);
  assert.doesNotMatch(route, /SUPABASE_ANON_KEY/);
  assert.doesNotMatch(route, /localStorage/);
});
