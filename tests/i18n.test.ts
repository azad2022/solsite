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
  assert.equal(getLocaleFromPath('/en/articles/solana'), 'en');
});

test('localized paths preserve existing Persian URLs and add /en for English', () => {
  assert.equal(getLocalizedPath('/solana-price', 'fa'), '/solana-price');
  assert.equal(getLocalizedPath('/solana-price', 'en'), '/en/solana-price');
  assert.equal(getLocalizedPath('/en/solana-price', 'fa'), '/solana-price');
  assert.equal(getLocalizedPath('/en/solana-price', 'en'), '/en/solana-price');
});

test('localized article paths map to the existing Persian article URL', () => {
  assert.equal(getLocalizedPath('/article/solana-defi', 'en'), '/en/articles/solana-defi');
  assert.equal(getLocalizedPath('/en/articles/solana-defi', 'fa'), '/article/solana-defi');
  assert.equal(getAlternateLocalePath('/en/articles/solana-defi', 'fa'), '/article/solana-defi');
  assert.equal(getAlternateLocalePath('/article/solana-defi', 'en'), '/en/articles/solana-defi');
});

test('path normalization strips the English prefix only for locale handling', () => {
  assert.equal(getPathWithoutLocale('/en'), '/');
  assert.equal(getPathWithoutLocale('/en/solana-price'), '/solana-price');
  assert.equal(getPathWithoutLocale('/en/articles/solana-defi'), '/articles/solana-defi');
});
