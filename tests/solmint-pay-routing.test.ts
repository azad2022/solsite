import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkoutIntentIdFromPath,
  isPayCheckoutPath,
  normalizePayPath,
  pathForPaySection,
  sectionFromPayPath,
} from '../src/pay/routing.ts';

test('Pay routing keeps /pay and valid Pay sections inside the Pay boundary', () => {
  assert.equal(normalizePayPath('/pay/'), '/pay');
  assert.equal(sectionFromPayPath('/pay'), 'overview');
  assert.equal(sectionFromPayPath('/pay/transactions'), 'transactions');
  assert.equal(sectionFromPayPath('/pay/security/'), 'security');
});

test('Pay routing never treats arbitrary nested paths as valid sections', () => {
  assert.equal(sectionFromPayPath('/pay/not-a-section'), 'overview');
  assert.equal(sectionFromPayPath('/pay/transactions/detail'), 'overview');
  assert.equal(sectionFromPayPath('/dashboard'), 'overview');
});

test('Pay navigation produces canonical section paths', () => {
  assert.equal(pathForPaySection('overview'), '/pay');
  assert.equal(pathForPaySection('transactions'), '/pay/transactions');
  assert.equal(pathForPaySection('security'), '/pay/security');
});

test('Checkout is a separate Pay boundary and preserves an optional intent identifier', () => {
  assert.equal(isPayCheckoutPath('/pay/checkout'), true);
  assert.equal(isPayCheckoutPath('/pay/checkout/intent_123'), true);
  assert.equal(checkoutIntentIdFromPath('/pay/checkout'), undefined);
  assert.equal(checkoutIntentIdFromPath('/pay/checkout/intent_123'), 'intent_123');
  assert.equal(isPayCheckoutPath('/pay/transactions'), false);
});
