import assert from 'node:assert/strict';
import test from 'node:test';

import { validateApiKeyFormat, validateApiKeyRecord } from '../src/pay/services/apiKeyPolicy';
import { authorizePayMerchant, hasPayPlatformCapability } from '../src/pay/services/authorizationPolicy';
import { authorizeMerchantResource, validateExternalOrderId, validateIdempotencyKey, validatePublicMetadata, validateWebhookUrl } from '../src/pay/services/securityPolicy';

const activeUser = {
  id: 'user-1',
  role: 'merchant',
  permissions: [],
  isActive: true,
} as const;

const merchant = {
  merchantId: 'merchant-1',
  ownerUserId: 'user-1',
  status: 'active' as const,
};

const ownerMembership = {
  merchantId: 'merchant-1',
  userId: 'user-1',
  role: 'owner' as const,
  status: 'active' as const,
};

test('API key format requires a long Pay bearer credential', () => {
  assert.equal(validateApiKeyFormat('sk_pay_short'), false);
  assert.equal(validateApiKeyFormat(`sk_pay_${'a'.repeat(64)}`), true);
});

test('API key validation fails closed for revoked, expired, or missing scopes', () => {
  const base = { merchantId: 'merchant-1', keyId: 'key-1', keyHash: 'hash', scopes: ['payment.create'], expiresAt: null, revokedAt: null };
  assert.deepEqual(validateApiKeyRecord(base, 'payment.create'), { valid: true, reason: 'OK' });
  assert.deepEqual(validateApiKeyRecord({ ...base, revokedAt: new Date().toISOString() }, 'payment.create'), { valid: false, reason: 'REVOKED' });
  assert.deepEqual(validateApiKeyRecord({ ...base, expiresAt: new Date(Date.now() - 1000).toISOString() }, 'payment.create'), { valid: false, reason: 'EXPIRED' });
  assert.deepEqual(validateApiKeyRecord(base, 'refund.create'), { valid: false, reason: 'SCOPE_REQUIRED' });
});

test('tenant authorization uses membership role rather than site-wide permission flags', () => {
  assert.equal(authorizePayMerchant(activeUser, merchant, ownerMembership, 'payment.create'), true);
  assert.equal(authorizePayMerchant(activeUser, merchant, { ...ownerMembership, role: 'viewer' }, 'payment.create'), false);
  assert.equal(authorizePayMerchant(activeUser, merchant, { ...ownerMembership, userId: 'user-2' }, 'payment.create'), false);
  assert.equal(authorizePayMerchant(activeUser, { ...merchant, status: 'suspended' }, ownerMembership, 'payment.create'), false);
  assert.equal(hasPayPlatformCapability(activeUser, 'payment.create'), false);
  assert.equal(hasPayPlatformCapability({ ...activeUser, permissions: ['pay:payment.create'] }, 'payment.create'), true);
});

test('generic authorization policy rejects cross-merchant access', () => {
  const denied = authorizeMerchantResource({ authenticatedUserId: 'user-a', merchantOwnerUserId: 'user-a', requestedMerchantId: 'merchant-b', resourceMerchantId: 'merchant-a', merchantStatus: 'active', canManageMerchant: true });
  assert.deepEqual(denied, { allowed: false, reason: 'MERCHANT_MISMATCH' });
});

test('input-boundary validation rejects common injection and SSRF primitives', () => {
  assert.equal(validateIdempotencyKey('request-123'), true);
  assert.equal(validateIdempotencyKey('bad\r\nheader'), false);
  assert.equal(validateIdempotencyKey(''), false);
  assert.equal(validateExternalOrderId('order-123'), true);
  assert.equal(validateExternalOrderId('bad\u0000id'), false);
  assert.equal(validateExternalOrderId(null), true);
  assert.equal(validatePublicMetadata({ order: '123', note: 'ok' }), true);
  assert.equal(validatePublicMetadata('x'.repeat(5000)), false);
  assert.equal(validateWebhookUrl('https://merchant.example/webhooks'), true);
  assert.equal(validateWebhookUrl('http://merchant.example/webhooks'), false);
  assert.equal(validateWebhookUrl('https://localhost/webhooks'), false);
  assert.equal(validateWebhookUrl('https://127.0.0.1/webhooks'), false);
  assert.equal(validateWebhookUrl('https://10.0.0.5/webhooks'), false);
  assert.equal(validateWebhookUrl('https://169.254.169.254/latest/meta-data'), false);
  assert.equal(validateWebhookUrl('https://[::1]/webhooks'), false);
  assert.equal(validateWebhookUrl('https://[fd00::1]/webhooks'), false);
  assert.equal(validateWebhookUrl('https://[fe80::1]/webhooks'), false);
  assert.equal(validateWebhookUrl('https://user:pass@merchant.example/webhooks'), false);
});
