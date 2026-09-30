import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/pay/components/pay-payment-links.css', 'utf8');

test('Payment Links mobile rows keep actions in a full-width reachable grid row', () => {
  assert.match(
    css,
    /@media\(max-width:640px\)[\s\S]*\.pay-payment-links-table tr\{[^}]*grid-template-columns:minmax\(0,1fr\)/,
  );
  assert.match(
    css,
    /@media\(max-width:640px\)[\s\S]*\.pay-payment-links-actions\{[^}]*grid-column:1 \/ -1;[^}]*justify-content:flex-end/,
  );
  assert.match(
    css,
    /@media\(max-width:640px\)[\s\S]*\.pay-payment-links-table td > code,[\s\S]*overflow-wrap:anywhere/,
  );
});
