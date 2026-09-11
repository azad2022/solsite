import assert from 'node:assert/strict';
import test from 'node:test';

import { PAY_CONFIG, isPayLaunchEnabled } from '../src/pay/app/config';
import { directionFor, normalizePayLocale, translate } from '../src/pay/i18n';
import { calculateGatewayFee } from '../src/pay/services/feePolicy';
import { canTransitionPayment } from '../src/pay/services/paymentStateMachine';
import { SOLMINT_PAY_FEE_BPS } from '../src/pay/types/domain';

test('SolMint Pay foundation keeps launch disabled until release gates pass', () => {
  assert.equal(isPayLaunchEnabled(), false);
  assert.equal(PAY_CONFIG.publicPath, '/pay');
});

test('gateway fee policy is centrally defined as 1%', () => {
  assert.equal(SOLMINT_PAY_FEE_BPS, 100);
  assert.equal(PAY_CONFIG.gatewayFeeBps, 100);
});

test('fee math uses atomic integer arithmetic for both fee payer modes', () => {
  assert.deepEqual(calculateGatewayFee('100000000', 100, 'merchant'), {
    gatewayFeeAtomic: '1000000',
    customerTotalAtomic: '100000000',
    merchantNetAtomic: '99000000',
  });
  assert.deepEqual(calculateGatewayFee('100000000', 100, 'customer'), {
    gatewayFeeAtomic: '1000000',
    customerTotalAtomic: '101000000',
    merchantNetAtomic: '100000000',
  });
  assert.equal(calculateGatewayFee('1', 100, 'customer').gatewayFeeAtomic, '1');
});

test('payment state machine permits only deliberate transitions', () => {
  assert.equal(canTransitionPayment('created', 'pending'), true);
  assert.equal(canTransitionPayment('pending', 'detected'), true);
  assert.equal(canTransitionPayment('underpaid', 'verifying'), true);
  assert.equal(canTransitionPayment('completed', 'pending'), false);
  assert.equal(canTransitionPayment('expired', 'completed'), false);
});

test('locale resolution and direction are deterministic', () => {
  assert.equal(normalizePayLocale('fa-AF'), 'fa-IR');
  assert.equal(normalizePayLocale('en-GB'), 'en-US');
  assert.equal(normalizePayLocale('ar-SA'), 'ar');
  assert.equal(normalizePayLocale('ru-RU'), 'ru');
  assert.equal(normalizePayLocale('de-DE'), 'fa-IR');
  assert.equal(directionFor('fa-IR'), 'rtl');
  assert.equal(directionFor('ar'), 'rtl');
  assert.equal(directionFor('en-US'), 'ltr');
  assert.equal(directionFor('ru'), 'ltr');
});

test('translation catalogs expose the same public keys', () => {
  assert.equal(translate('fa-IR', 'paymentConfirmed'), 'پرداخت تأیید شد');
  assert.equal(translate('en-US', 'paymentConfirmed'), 'Payment confirmed');
});