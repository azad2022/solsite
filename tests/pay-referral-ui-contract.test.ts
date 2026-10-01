import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync('src/pay/PayApp.tsx','utf8');
const ui = readFileSync('src/pay/components/PayReferrals.tsx','utf8');
const i18n = readFileSync('src/pay/components/pay-referrals-i18n.ts','utf8');

test('PayApp wires the referral surface and uses a flat primary navigation', () => {
  assert.match(app,/import PayReferrals from '.\/components\/PayReferrals'/);
  assert.match(app,/showReferrals/);
  assert.match(app,/<PayReferrals locale=\{locale\}/);
  assert.match(app,/PAY_NAV_SECTIONS/);
  assert.doesNotMatch(app,/PAY_NAV_GROUP_LABELS/);
  assert.doesNotMatch(app,/pay-nav-group-label/);
});

test('Referral UI exposes the dedicated referral link and click/signup/earnings stats', () => {
  assert.match(ui,/\/r\//);
  assert.match(ui,/data\.stats\.clicks/);
  assert.match(ui,/data\.stats\.directSignups/);
  assert.match(ui,/data\.earnings_by_asset/);
  assert.match(ui,/navigator\.clipboard\.writeText/);
  assert.match(ui,/window\.location\.origin/);
  assert.match(ui,/'\/r\/'/);
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


test('Referral UI includes a localized promotional video asset without autoplay', () => {
  assert.match(ui,/pay-referrals-promo/);
  assert.match(ui,/\/assets\/pay-referral-promo\.mp4/);
  assert.match(ui,/preload="metadata"/);
  assert.match(ui,/playsInline/);
  assert.doesNotMatch(ui,/autoplay/);
  assert.match(i18n,/promoKicker/);
  assert.match(i18n,/promoTitle/);
  assert.match(i18n,/promoDescription/);
});
