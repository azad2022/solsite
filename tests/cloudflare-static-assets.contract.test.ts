import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const middleware = readFileSync('functions/_middleware.ts', 'utf8');

test('Pages middleware passes fingerprinted assets directly to the ASSETS binding', () => {
  assert.match(middleware, /assetPath\.startsWith\('\/assets\/'\)/);
  assert.match(middleware, /context\.env\.ASSETS\.fetch\(context\.request\)/);
  assert.doesNotMatch(middleware, /assetPath\.startsWith\('\/assets\/'\)[\s\S]{0,220}serveSpaShell/);
});
