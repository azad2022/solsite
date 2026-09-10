import assert from 'node:assert/strict';
import test from 'node:test';
import {
  API_KEY_PREFIX,
  API_KEY_SCOPE,
  apiKeyDisplayPrefix,
  createApiKeySecret,
  hashApiKeySecret,
  validateApiKeyFormat,
  validateApiKeyRecord,
} from '../src/pay/services/apiKeyPolicy';

test('API key secret uses the existing sk_pay_ contract and validates', () => {
  const secret = createApiKeySecret();
  assert.match(secret, new RegExp(`^${API_KEY_PREFIX}`));
  assert.equal(validateApiKeyFormat(secret), true);
  assert.equal(apiKeyDisplayPrefix(secret).length, 16);
  assert.equal(apiKeyDisplayPrefix(secret).startsWith(API_KEY_PREFIX), true);
});

test('API key generation has sufficient uniqueness for independent credentials', () => {
  const first = createApiKeySecret();
  const second = createApiKeySecret();
  assert.notEqual(first, second);
});

test('API key hashing is deterministic and never changes the accepted secret format', async () => {
  const secret = createApiKeySecret();
  const hashA = await hashApiKeySecret(secret);
  const hashB = await hashApiKeySecret(secret);
  assert.match(hashA, /^[0-9a-f]{64}$/);
  assert.equal(hashA, hashB);
  assert.equal(validateApiKeyFormat(secret), true);
});

test('API key record rejects revoked and expired credentials and accepts the current scope', () => {
  const base = {
    merchantId: 'merchant',
    keyId: 'key',
    keyHash: 'a'.repeat(64),
    scopes: [API_KEY_SCOPE],
  };
  assert.deepEqual(validateApiKeyRecord({ ...base, expiresAt: null, revokedAt: null }), { valid: true, reason: 'OK' });
  assert.deepEqual(validateApiKeyRecord({ ...base, expiresAt: new Date(Date.now() - 1000).toISOString(), revokedAt: null }), { valid: false, reason: 'EXPIRED' });
  assert.deepEqual(validateApiKeyRecord({ ...base, expiresAt: null, revokedAt: new Date().toISOString() }), { valid: false, reason: 'REVOKED' });
  assert.deepEqual(validateApiKeyRecord({ ...base, expiresAt: null, revokedAt: null }, 'payment.read'), { valid: false, reason: 'SCOPE_REQUIRED' });
});
