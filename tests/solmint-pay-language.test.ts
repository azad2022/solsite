import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PAY_LOCALE,
  PAY_LOCALES,
  PAY_LOCALE_FLAGS,
  PAY_LOCALE_SHORT_CODES,
  PAY_LOCALE_STORAGE_KEY,
  directionFor,
  languageName,
  normalizePayLocale,
  persistPayLocale,
  readStoredPayLocale,
} from '../src/pay/i18n.ts';

test('Pay locale preference persists only canonical supported locales', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
  };

  assert.equal(readStoredPayLocale(storage), null);
  persistPayLocale(storage, 'fa-IR');
  assert.equal(values.get(PAY_LOCALE_STORAGE_KEY), 'fa-IR');
  assert.equal(readStoredPayLocale(storage), 'fa-IR');

  values.set(PAY_LOCALE_STORAGE_KEY, 'en');
  assert.equal(readStoredPayLocale(storage), null);
  values.set(PAY_LOCALE_STORAGE_KEY, 'de-DE');
  assert.equal(readStoredPayLocale(storage), null);
});

test('Pay locale metadata covers every active locale used by the selector', () => {
  assert.deepEqual(PAY_LOCALES, ['fa-IR', 'en-US', 'ar', 'ru']);
  for (const locale of PAY_LOCALES) {
    assert.ok(PAY_LOCALE_FLAGS[locale]);
    assert.ok(PAY_LOCALE_SHORT_CODES[locale]);
    assert.ok(languageName(locale));
  }
  assert.equal(PAY_LOCALE_FLAGS['fa-IR'], '🇮🇷');
  assert.equal(PAY_LOCALE_FLAGS['en-US'], '🇺🇸');
  assert.equal(PAY_LOCALE_FLAGS.ar, '🇸🇦');
  assert.equal(PAY_LOCALE_FLAGS.ru, '🇷🇺');
});

test('Pay locale fallback remains the navigator-based default when storage is absent', () => {
  assert.equal(normalizePayLocale('fa'), 'fa-IR');
  assert.equal(directionFor(DEFAULT_PAY_LOCALE), 'rtl');
  assert.equal(directionFor('ar'), 'rtl');
  assert.equal(directionFor('en-US'), 'ltr');
  assert.equal(directionFor('ru'), 'ltr');
});
