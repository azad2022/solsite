import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutLabel, checkoutLabelKeys } from '../src/pay/checkout-i18n';
import { paymentReceiptLabel, paymentReceiptLabelKeys } from '../src/pay/components/pay-payment-receipt-i18n';

const locales = ['fa-IR', 'en-US', 'ar', 'ru'] as const;

test('checkout translation catalog has a non-empty entry for every supported locale and key', () => {
  for (const locale of locales) {
    for (const key of checkoutLabelKeys) {
      assert.notEqual(checkoutLabel(locale, key), '', locale + ' missing checkout key ' + key);
    }
  }
});

test('payment receipt translation catalog has a non-empty entry for every supported locale and key', () => {
  for (const locale of locales) {
    for (const key of paymentReceiptLabelKeys) {
      assert.notEqual(paymentReceiptLabel(locale, key), '', locale + ' missing receipt key ' + key);
    }
  }
});
