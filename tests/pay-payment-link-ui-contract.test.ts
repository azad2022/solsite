import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync('src/pay/PayApp.tsx','utf8');
const ui = readFileSync('src/pay/components/PayPaymentLinks.tsx','utf8');

test('PayApp wires Payment Links into the existing invoice management surface', () => {
  assert.match(app,/import PayPaymentLinks from '.\/components\/PayPaymentLinks'/);
  assert.match(app,/showInvoices/);
  assert.match(app,/<PayPaymentLinks locale=\{locale\} merchantId=\{merchant\.id\}/);
});

test('Payment Link UI stays behind the Pay service boundary and exposes no guessed public route', () => {
  assert.match(ui,/payPaymentLinkService\.list/);
  assert.doesNotMatch(ui,/fetch\(/);
  assert.doesNotMatch(ui,/\/pay\/link\//);
});
