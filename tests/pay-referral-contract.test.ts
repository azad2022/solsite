import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync('functions/api/pay/v1/referrals.ts','utf8');
const service = readFileSync('src/pay/services/referralService.ts','utf8');

test('Referral GET reads only released affiliate/referral/commission fields', () => {
  assert.match(route,/const AFFILIATE_SELECT = 'id,display_name,referral_code,commission_rate_bps,status,created_at,updated_at'/);
  assert.match(route,/const REFERRAL_SELECT = 'id,affiliate_id,merchant_id,referral_code,attributed_at,active'/);
  assert.match(route,/const COMMISSION_SELECT = 'id,referral_id,payment_id,gross_gateway_fee_atomic,commission_bps,commission_atomic,status,created_at,approved_at,paid_at'/);
});

test('Referral GET uses the authenticated identity path', () => {
  assert.match(route,/resolvePayIdentity\(request, env\)/);
  assert.match(route,/supabaseRequestAsIdentity\(/);
  assert.doesNotMatch(route,/SUPABASE_SERVICE_ROLE_KEY/);
});

test('Referral parser keeps financial amounts atomic and does not calculate commission', () => {
  assert.match(service,/atomicField\(/);
  assert.doesNotMatch(service,/commission_atomic.*[/] 100/);
});
