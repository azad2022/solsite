import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync('src/pay/PayApp.tsx', 'utf8');
const ui = readFileSync('src/pay/components/PayInvoices.tsx', 'utf8');

test('PayApp wires the invoice surface', () => {
  assert.match(app, /import PayInvoices from '.\/components\/PayInvoices'/);
  assert.match(app, /showInvoices/);
  assert.match(app, /<PayInvoices locale=\{locale\} merchantId=\{merchant\.id\}/);
});

test('Invoice UI uses the Pay service boundary and stays read-only', () => {
  assert.match(ui, /payInvoiceService\.list/);
  assert.match(ui, /Invoice creation or mutation remains disabled until an official Backend contract is released/);
  assert.doesNotMatch(ui, /fetch\(/);
});
