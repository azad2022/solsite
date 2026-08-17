import assert from 'node:assert/strict';
import test from 'node:test';
import { getAlternateLocalePath, getLocaleFromPath, getLocalizedPath, getPathWithoutLocale } from '../src/utils/i18n';

test('locale detection keeps existing Persian routes as fa', () => {
  assert.equal(getLocaleFromPath('/'), 'fa');
  assert.equal(getLocaleFromPath('/solana-price'), 'fa');
  assert.equal(getLocaleFromPath('/article/solana'), 'fa');
});

test('locale detection recognizes /en and nested English routes', () => {
  assert.equal(getLocaleFromPath('/en'), 'en');
  assert.equal(getLocaleFromPath('/en/'), 'en');
  assert.equal(getLocaleFromPath('/en/solana-price'), 'en');
});

test('localized paths preserve existing Persian URLs and add /en for English', () => {
  assert.equal(getLocalizedPath('/solana-price', 'fa'), '/solana-price');
  assert.equal(getLocalizedPath('/solana-price', 'en'), '/en/solana-price');
  assert.equal(getLocalizedPath('/en/solana-price', 'fa'), '/solana-price');
  assert.equal(getLocalizedPath('/en/solana-price', 'en'), '/en/solana-price');
});

test('alternate locale paths map a route to its counterpart', () => {
  assert.equal(getAlternateLocalePath('/solana-price', 'en'), '/en/solana-price');
  assert.equal(getAlternateLocalePath('/en/solana-price', 'fa'), '/solana-price');
  assert.equal(getPathWithoutLocale('/en'), '/');
});
