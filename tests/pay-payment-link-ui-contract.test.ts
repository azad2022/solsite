import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { matchPayRoute } from '../src/pay/route-match';

const app = readFileSync('src/pay/PayApp.tsx', 'utf8');
const ui = readFileSync('src/pay/components/PayPaymentLinks.tsx', 'utf8');

test('PayApp exposes the public payment link route and keeps it outside merchant dashboard rendering', () => {
  assert.match(app, /PayPublicPaymentLink/);
  assert.match(app, /route\.kind === 'payment-link'/);
  const route = matchPayRoute('/pay/link/solmint-store');
  assert.deepEqual(route, { kind: 'payment-link', slug: 'solmint-store' });
  assert.deepEqual(matchPayRoute('/pay/link/invalid_slug'), { kind: 'not-found' });
});

test('Payment Link UI uses the service boundary and provides create/edit/deactivate/delete/share actions', () => {
  assert.match(ui, /payPaymentLinkService\.list/);
  assert.match(ui, /payPaymentLinkService\.create/);
  assert.match(ui, /payPaymentLinkService\.update/);
  assert.match(ui, /payPaymentLinkService\.remove/);
  assert.match(ui, /deleteConfirm/);
  assert.match(ui, /publicUrl/);
  assert.match(ui, /navigator\.clipboard/);
  assert.doesNotMatch(ui, /fetch\(/);
});


test('Payment Link create stays disabled until merchant and authoritative asset metadata are ready', () => {
  assert.match(ui, /const EMPTY_ASSET_DECIMALS = \{ SOL: null, USDC: null, USDT: null \};/);
  assert.match(ui, /useState<\{ SOL: number \| null; USDC: number \| null; USDT: number \| null \}>\(\{ \.\.\.EMPTY_ASSET_DECIMALS \}\)/);
  assert.match(ui, /setAssetDecimals\(\{ \.\.\.EMPTY_ASSET_DECIMALS \}\)/);
  assert.match(ui, /disabled=\{creating \|\| !merchantId \|\| loading \|\| assetDecimals\[draft\.asset\] === null\}/);
  assert.match(ui, /decimals === null/);
});
