import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyPayAuthBridgeError } from '../functions/api/pay/_shared/identity.ts';

test('classifies internal JWT configuration failures without exposing secret values', () => {
  assert.equal(
    classifyPayAuthBridgeError(new Error('SUPABASE_INTERNAL_JWT_PRIVATE_KEY must be a PKCS#8 PEM private key.')),
    'AUTH_BRIDGE_PRIVATE_KEY_INVALID',
  );
  assert.equal(
    classifyPayAuthBridgeError(new Error('SUPABASE_INTERNAL_JWT_PRIVATE_KEY contains invalid base64 data.')),
    'AUTH_BRIDGE_PRIVATE_KEY_INVALID',
  );
  assert.equal(
    classifyPayAuthBridgeError(new Error('SUPABASE_INTERNAL_JWT_ALGORITHM must be explicitly configured as ES256 or RS256.')),
    'AUTH_BRIDGE_CONFIG_INVALID',
  );
  assert.equal(
    classifyPayAuthBridgeError(new Error('SUPABASE_INTERNAL_JWT_AUDIENCE is required for the Pay internal JWT bridge.')),
    'AUTH_BRIDGE_CONFIG_INVALID',
  );
  assert.equal(
    classifyPayAuthBridgeError(new Error('Data provided to an operation does not meet the requirements.')),
    'AUTH_BRIDGE_CRYPTO_FAILED',
  );
  assert.equal(
    classifyPayAuthBridgeError(new Error('unexpected runtime failure')),
    'AUTH_BRIDGE_RUNTIME_FAILED',
  );
});
