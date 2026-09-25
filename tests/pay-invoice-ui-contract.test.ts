import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app=readFileSync('src/pay/PayApp.tsx','utf8');
const ui=readFileSync('src/pay/components/PayInvoices.tsx','utf8');
const copy=readFileSync('src/pay/components/pay-invoices-i18n.ts','utf8');

test('PayApp wires the invoice surface',()=>{
 assert.match(app,/import PayInvoices from '.\/components\/PayInvoices'/);
 assert.match(app,/showInvoices/); assert.match(app,/<PayInvoices locale=\{locale\} merchantId=\{merchant\.id\}/);
});
test('Invoice UI uses the service boundary and exposes a guarded create form',()=>{
 assert.match(ui,/payInvoiceService\.list/); assert.match(ui,/payInvoiceService\.create/);
 assert.match(ui,/payInvoiceService\.create/); assert.match(copy,/createTitle/);
 assert.doesNotMatch(ui,/fetch\(/); assert.doesNotMatch(copy,/remains disabled until an official Backend contract is released/);
});
