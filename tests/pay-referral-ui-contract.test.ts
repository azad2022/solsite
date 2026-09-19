import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync('src/pay/PayApp.tsx','utf8');
const ui = readFileSync('src/pay/components/PayReferrals.tsx','utf8');

test('PayApp wires the referral surface', () => {
  assert.match(app,/import PayReferrals from '.\/components\/PayReferrals'/);
  assert.match(app,/showReferrals/);
  assert.match(app,/<PayReferrals locale=\{locale\}/);
});

test('Referral UI uses the Pay service boundary and does not calculate payouts', () => {
  assert.match(ui,/payReferralService\.load/);
  assert.doesNotMatch(ui,/fetch\(/);
  assert.doesNotMatch(ui,/commission_atomic.*[/] 100/);
});
