import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync('src/pay/PayApp.tsx','utf8');
const ui = readFileSync('src/pay/components/PayReferrals.tsx','utf8');
const i18n = readFileSync('src/pay/components/pay-referrals-i18n.ts','utf8');

test('PayApp wires the referral surface', () => {
  assert.match(app,/import PayReferrals from '.\/components\/PayReferrals'/);
  assert.match(app,/showReferrals/);
  assert.match(app,/<PayReferrals locale=\{locale\}/);
});

test('Referral UI exposes the dedicated referral link and click/signup/earnings stats', () => {
  assert.match(ui,/\/r\//);
  assert.match(ui,/data\.stats\.clicks/);
  assert.match(ui,/data\.stats\.directSignups/);
  assert.match(ui,/data\.earnings_by_asset/);
  assert.match(ui,/navigator\.clipboard\.writeText/);
});

test('Referral UI uses the Pay service boundary and never calculates financial truth', () => {
  assert.match(ui,/payReferralService\.load/);
  assert.doesNotMatch(ui,/fetch\(/);
  assert.doesNotMatch(ui,/commission_atomic.*[/] 100/);
  assert.doesNotMatch(ui,/gross_gateway_fee_atomic.*[/] 100/);
});

test('Referral UI has all four required locales', () => {
  assert.match(i18n,/'fa-IR'/);
  assert.match(i18n,/'en-US'/);
  assert.match(i18n,/\bar:/);
  assert.match(i18n,/\bru:/);
});
