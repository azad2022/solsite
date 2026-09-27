import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync('src/pay/PayApp.tsx', 'utf8');
const ui = readFileSync('src/pay/components/PayPaymentLinks.tsx', 'utf8');
const routeMatch = readFileSync('src/pay/route-match.ts', 'utf8');

test('PayApp exposes the public payment link route and keeps it outside merchant dashboard rendering', () => {
  assert.match(app, /PayPublicPaymentLink/);
  assert.match(app, /route\.kind === 'payment-link'/);
  assert.match(routeMatch, /kind: 'payment-link'/);
  assert.match(routeMatch, /pay\/link\//);
});

test('Payment Link UI uses the service boundary and provides create/share actions', () => {
  assert.match(ui, /payPaymentLinkService\.list/);
  assert.match(ui, /payPaymentLinkService\.create/);
  assert.match(ui, /publicUrl/);
  assert.match(ui, /navigator\.clipboard/);
  assert.doesNotMatch(ui, /fetch\(/);
});
