import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  getAlternateLocalePath,
  getLocaleFromPath,
  getLocalizedPath,
  getPathWithoutLocale,
  normalizePath,
} from '../src/utils/i18n';

test('normalizes paths without changing the root route', () => {
  assert.equal(normalizePath('/articles///'), '/articles');
  assert.equal(normalizePath('/'), '/');
  assert.equal(normalizePath('/en/?utm_source=test'), '/en');
});

test('detects English only from the reserved /en namespace', () => {
  assert.equal(getLocaleFromPath('/'), 'fa');
  assert.equal(getLocaleFromPath('/solana-price'), 'fa');
  assert.equal(getLocaleFromPath('/en'), 'en');
  assert.equal(getLocaleFromPath('/en/solana-price'), 'en');
  assert.equal(getLocaleFromPath('/english/solana-price'), 'fa');
});

test('converts localized and canonical paths without nesting /en twice', () => {
  assert.equal(getLocalizedPath('/solana-price', 'en'), '/en/solana-price');
  assert.equal(getLocalizedPath('/en/solana-price', 'en'), '/en/solana-price');
  assert.equal(getLocalizedPath('/en/solana-price', 'fa'), '/solana-price');
  assert.equal(getLocalizedPath('/', 'en'), '/en');
});

test('returns canonical route path without locale prefix', () => {
  assert.equal(getPathWithoutLocale('/en'), '/');
  assert.equal(getPathWithoutLocale('/en/articles/solana'), '/articles/solana');
  assert.equal(getPathWithoutLocale('/articles/solana'), '/articles/solana');
});

test('builds alternate-language paths for the same route', () => {
  assert.equal(getAlternateLocalePath('/solana-price', 'en'), '/en/solana-price');
  assert.equal(getAlternateLocalePath('/en/solana-price', 'fa'), '/solana-price');
});
