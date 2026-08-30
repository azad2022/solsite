import assert from 'node:assert/strict';
import test from 'node:test';

import { PAY_CONFIG, isPayLaunchEnabled } from '../src/pay/app/config';
import { createPayTranslator, getPayDirection, resolvePayLocale } from '../src/pay/i18n';
import { SOLMINT_PAY_FEE_BPS } from '../src/pay/types/domain';

test('SolMint Pay foundation keeps launch disabled until release gates pass', () => {
  assert.equal(isPayLaunchEnabled(), false);
  assert.equal(PAY_CONFIG.publicPath, '/pay');
});

test('gateway fee policy is centrally defined as 1%', () => {
  assert.equal(SOLMINT_PAY_FEE_BPS, 100);
  assert.equal(PAY_CONFIG.gatewayFeeBps, 100);
});

test('locale resolution and direction are deterministic', () => {
  assert.equal(resolvePayLocale('fa-AF'), 'fa-IR');
  assert.equal(resolvePayLocale('en-GB'), 'en-US');
  assert.equal(resolvePayLocale('ar-SA'), 'ar');
  assert.equal(resolvePayLocale('ru-RU'), 'ru');
  assert.equal(resolvePayLocale('de-DE'), 'fa-IR');

  assert.equal(getPayDirection('fa-IR'), 'rtl');
  assert.equal(getPayDirection('ar'), 'rtl');
  assert.equal(getPayDirection('en-US'), 'ltr');
  assert.equal(getPayDirection('ru'), 'ltr');
});

test('translation catalogs expose the same public keys', () => {
  const fa = createPayTranslator('fa-IR');
  const en = createPayTranslator('en-US');
  assert.equal(fa('paymentConfirmed'), 'پرداخت تأیید شد');
  assert.equal(en('paymentConfirmed'), 'Payment confirmed');
});
