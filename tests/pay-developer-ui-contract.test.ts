import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync('src/pay/PayApp.tsx','utf8');
const ui = readFileSync('src/pay/components/PayDeveloper.tsx','utf8');

test('PayApp wires the Developer documentation surface', () => {
  assert.match(app,/import PayDeveloper from '.\/components\/PayDeveloper'/);
  assert.match(app,/showDeveloper/);
  assert.match(app,/<PayDeveloper locale=\{locale\}/);
});

test('Developer surface links only to repository-published documentation resources', () => {
  assert.match(ui,/\/api-docs\//);
  assert.match(ui,/\/openapi\.json/);
  assert.match(ui,/\/.well-known\/api-catalog/);
  assert.match(ui,/\/api\/pay\/v1\/payment-intents\/\{id\}/);
  assert.match(ui,/\/api\/pay\/v1\/invoices/);
  assert.match(ui,/\/api\/pay\/v1\/payment-links/);
  assert.match(ui,/\/api\/pay\/v1\/referrals/);
  assert.match(ui,/\/api\/pay\/v1\/customers/);
  assert.match(ui,/\/api\/pay\/v1\/reports/);
  assert.doesNotMatch(ui,/apiKey.*secret/i);
  assert.doesNotMatch(ui,/private.?key|seed.?phrase/i);
});
