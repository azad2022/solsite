import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PAY_LOCALE, directionFor, normalizePayLocale, sectionLabel, sectionNavLabel, translate } from '../src/pay/i18n.ts';

test('Pay i18n normalizes supported locale aliases', () => {
  assert.equal(normalizePayLocale('fa'), 'fa-IR');
  assert.equal(normalizePayLocale('en'), 'en-US');
  assert.equal(normalizePayLocale('ar'), 'ar');
  assert.equal(normalizePayLocale('ru'), 'ru');
  assert.equal(normalizePayLocale('de-DE'), DEFAULT_PAY_LOCALE);
});

test('Pay i18n exposes correct direction for each locale family', () => {
  assert.equal(directionFor('fa-IR'), 'rtl');
  assert.equal(directionFor('ar'), 'rtl');
  assert.equal(directionFor('en-US'), 'ltr');
  assert.equal(directionFor('ru'), 'ltr');
});

test('Pay section labels and checkout states come from the central catalogue', () => {
  assert.equal(sectionLabel('en-US', 'transactions'), 'Transactions');
  assert.equal(sectionLabel('fa-IR', 'security'), 'امنیت');
  assert.equal(sectionLabel('ar', 'reports'), 'التقارير');
  assert.equal(sectionLabel('ru', 'developer'), 'Разработчик');
  assert.equal(sectionNavLabel('fa-IR', 'payment-links'), 'لینک پرداخت');
  assert.equal(sectionNavLabel('fa-IR', 'invoices'), 'فاکتور');
  assert.equal(sectionNavLabel('fa-IR', 'referrals'), 'کسب درآمد');
  assert.equal(sectionNavLabel('fa-IR', 'developer'), 'برنامه‌نویسان');
  assert.equal(sectionNavLabel('en-US', 'payment-links'), 'Payment link');
  assert.equal(translate('en-US', 'emptyTitle'), 'Operational data is not available yet');
  assert.equal(translate('fa-IR', 'checkoutSecure'), 'اتصال امن');
  assert.equal(translate('ru', 'awaitingIntent'), 'Ожидание Intent');
});
