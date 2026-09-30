import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync('src/pay/components/pay-payment-links.css', 'utf8');

test('Payment Links mobile cards keep actions in the header grid area', () => {
  assert.match(
    css,
    /@media\(max-width:640px\)[\s\S]*\.pay-payment-links-table tr\{[^}]*grid-template-columns:minmax\(0,1fr\) auto/,
  );
  assert.match(
    css,
    /@media\(max-width:640px\)[\s\S]*\.pay-payment-links-table td:first-child\{grid-column:1;grid-row:1/,
  );
  assert.match(
    css,
    /@media\(max-width:640px\)[\s\S]*\.pay-payment-links-actions\{grid-column:2;grid-row:1/,
  );
});
