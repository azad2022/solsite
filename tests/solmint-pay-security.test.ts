import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authorizeMerchantResource,
  validateExternalOrderId,
  validateIdempotencyKey,
  validatePublicMetadata,
  validateWebhookUrl,
} from '../src/pay/services/securityPolicy';

test('security input policies reject unsafe idempotency/order values', () => {
  assert.equal(validateIdempotencyKey('request-123'), true);
  assert.equal(validateIdempotencyKey('bad\r\nheader'), false);
  assert.equal(validateIdempotencyKey(''), false);
  assert.equal(validateExternalOrderId('order-123'), true);
  assert.equal(validateExternalOrderId('bad\u0000id'), false);
  assert.equal(validateExternalOrderId(null), true);
});

test('public metadata has a bounded serialized size', () => {
  assert.equal(validatePublicMetadata({ order: '123', note: 'ok' }), true);
  assert.equal(validatePublicMetadata('x'.repeat(5000)), false);
});

test('webhook URL policy rejects dangerous schemes and local destinations', () => {
  assert.equal(validateWebhookUrl('https://merchant.example/webhooks'), true);
  assert.equal(validateWebhookUrl('http://merchant.example/webhooks'), false);
  assert.equal(validateWebhookUrl('https://localhost/webhooks'), false);
  assert.equal(validateWebhookUrl('https://127.0.0.1/webhooks'), false);
  assert.equal(validateWebhookUrl('https://10.0.0.5/webhooks'), false);
  assert.equal(validateWebhookUrl('https://169.254.169.254/latest/meta-data'), false);
  assert.equal(validateWebhookUrl('https://[::1]/webhooks'), false);
  assert.equal(validateWebhookUrl('https://user:pass@merchant.example/webhooks'), false);
});

test('merchant authorization fails closed on cross-merchant access', () => {
  const denied = authorizeMerchantResource({
    authenticatedUserId: 'user-a',
    merchantOwnerUserId: 'user-a',
    requestedMerchantId: 'merchant-b',
    resourceMerchantId: 'merchant-a',
    merchantStatus: 'active',
    canManageMerchant: true,
  });
  assert.deepEqual(denied, { allowed: false, reason: 'MERCHANT_MISMATCH' });

  const allowed = authorizeMerchantResource({
    authenticatedUserId: 'user-a',
    merchantOwnerUserId: 'user-a',
    requestedMerchantId: 'merchant-a',
    resourceMerchantId: 'merchant-a',
    merchantStatus: 'active',
    canManageMerchant: true,
  });
  assert.deepEqual(allowed, { allowed: true, reason: 'OK' });
});
