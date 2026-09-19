import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app=readFileSync('src/pay/PayApp.tsx','utf8');
const ui=readFileSync('src/pay/components/PayUnavailableFeature.tsx','utf8');

test('Missing Pay contracts render an explicit unavailable state instead of fake data',()=>{
  assert.match(app,/PayUnavailableFeature/);
  assert.match(app,/currentSection/);
  assert.match(ui,/Backend contract/);
  assert.match(ui,/notReleased/);
  assert.doesNotMatch(ui,/fetch\(/);
});
