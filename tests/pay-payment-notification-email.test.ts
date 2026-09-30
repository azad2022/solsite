import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMerchantPaymentNotificationEmail } from '../functions/api/pay/v1/_shared/paymentEmail';

test('merchant payment email is localized and does not expose unescaped payer input in HTML', () => {
  const email = buildMerchantPaymentNotificationEmail({
    outcome: 'success',
    locale: 'fa-IR',
    merchantName: 'فروشگاه <امن>',
    paymentId: '11111111-1111-4111-8111-111111111111',
    paymentStatus: 'confirmed',
    amountAtomic: '2000000',
    asset: 'USDC',
    tokenDecimals: 6,
    customerFirstName: 'علی <script>',
    customerLastName: 'احمدی',
    customerPurpose: 'پرداخت <سفارش> & خدمات',
  });
  assert.match(email.subject, /رسید پرداخت موفق/);
  assert.match(email.html, /Payment Intent/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /&lt;سفارش&gt;/);
  assert.match(email.html, /&amp; خدمات/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.text, /2 USDC/);
});

test('merchant failure email reflects authoritative negative payment state', () => {
  const email = buildMerchantPaymentNotificationEmail({
    outcome: 'failure',
    locale: 'en-US',
    merchantName: 'SolMint Store',
    paymentId: '22222222-2222-4222-8222-222222222222',
    paymentStatus: 'underpaid',
    amountAtomic: '1000000',
    asset: 'USDC',
    tokenDecimals: 6,
    customerFirstName: 'Ali',
    customerLastName: 'Ahmadi',
    customerPurpose: 'Order 42',
  });
  assert.match(email.subject, /SolMint Pay payment outcome/);
  assert.match(email.text, /underpaid/);
  assert.match(email.text, /1 USDC/);
});

test('SOL notification formatting uses atomic units without floating point arithmetic', () => {
  const email = buildMerchantPaymentNotificationEmail({
    outcome: 'success',
    locale: 'ru',
    merchantName: 'Store',
    paymentId: '33333333-3333-4333-8333-333333333333',
    paymentStatus: 'confirmed',
    amountAtomic: '1234567890',
    asset: 'SOL',
    tokenDecimals: null,
    customerFirstName: 'Иван',
    customerLastName: 'Петров',
    customerPurpose: 'Order',
  });
  assert.match(email.text, /1.23456789 SOL/);
  assert.doesNotMatch(email.text, /1\.234567890000000/);
});
