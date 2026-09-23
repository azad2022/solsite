import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const guide = readFileSync('src/pay/components/PayGettingStartedGuide.tsx', 'utf8');
const guideCss = readFileSync('src/pay/components/pay-getting-started.css', 'utf8');
const app = readFileSync('src/pay/PayApp.tsx', 'utf8');
const payCss = readFileSync('src/pay/pay.css', 'utf8');

test('Pay getting-started guide is localized for the supported Pay locales', () => {
  for (const locale of ['fa-IR', 'en-US', 'ar', 'ru']) {
    assert.ok(guide.includes(`'${locale}':`), `Missing localized guide entry for ${locale}`);
  }
  assert.ok(guide.includes("merchantLoadState === 'loading'"));
  assert.ok(guide.includes("merchantLoadState === 'error'"));
  assert.match(guide, /onRetryMerchant/);
});

test('Pay getting-started guide derives readiness from authoritative Merchant fields', () => {
  assert.match(guide, /merchant\?\.status === 'active'/);
  assert.match(guide, /verificationStatus === 'verified'/);
  assert.match(guide, /merchantNotActive/);
  assert.doesNotMatch(guide, /walletVerified \? t\(\.merchantActive/);
});

test('Pay keeps Merchant lookup failures distinct from the create state', () => {
  assert.match(app, /type MerchantLoadState = 'loading' \| 'ready' \| 'error'/);
  assert.match(app, /merchantLoadState === 'ready'/);
  assert.match(app, /setMerchantLoadState\('error'\)/);
});

test('Pay mobile drawer is fully off-canvas in both directions and clips horizontal overflow', () => {
  assert.match(payCss, /transform: translate3d\(-100%, 0, 0\)/);
  assert.match(payCss, /transform: translate3d\(100%, 0, 0\)/);
  assert.match(payCss, /\.solmint-pay\[dir='rtl'\] \.pay-sidebar/);
  assert.match(payCss, /overflow-x: clip/);
  assert.match(payCss, /touch-action: none/);
});

test('Pay guide responsive surface collapses before mobile width', () => {
  assert.match(guideCss, /@media\(max-width:1050px\)/);
  assert.match(guideCss, /@media\(max-width:700px\)/);
});
