import assert from 'node:assert/strict';
import test from 'node:test';
import { publicPaymentLinkKeys, publicPaymentLinkT } from '../src/pay/components/pay-public-payment-link-i18n';

const locales = ['fa-IR', 'en-US', 'ar', 'ru'] as const;

test('public payment-link catalog is complete for every supported locale', () => {
  for (const locale of locales) {
    for (const key of publicPaymentLinkKeys) {
      assert.notEqual(publicPaymentLinkT(locale, key), '', locale + ' missing public payment-link key ' + key);
    }
  }
});
