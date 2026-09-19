import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app=readFileSync('src/pay/PayApp.tsx','utf8');
const ui=readFileSync('src/pay/components/PayUnavailableFeature.tsx','utf8');
const copy=readFileSync('src/pay/components/pay-unavailable-i18n.ts','utf8');

test('Missing Pay contracts render an explicit unavailable state instead of fake data',()=>{
  assert.match(app,/PayUnavailableFeature/);
  assert.match(app,/currentSection/);
  assert.match(ui,/payUnavailableT/);
  assert.match(copy,/backendUnavailable/);
  assert.match(copy,/notReleased/);
  assert.doesNotMatch(ui,/fetch\(/);
});
