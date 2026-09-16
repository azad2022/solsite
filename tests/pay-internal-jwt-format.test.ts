import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';

import { mintPayInternalJwt, validatePayInternalJwtConfig } from '../functions/api/pay/_shared/internal-jwt.ts';

function toPem(key: Buffer): string {
  const body = key.toString('base64').match(/.{1,64}/g)?.join('\n') ?? '';
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
}

test('accepts Cloudflare-safe escaped newlines without weakening PKCS#8 validation', async () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pem = toPem(privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer);
  const escapedPem = pem.replace(/\r?\n/g, '\\n');
  const env = {
    SUPABASE_URL: 'https://example.test',
    SUPABASE_INTERNAL_JWT_PRIVATE_KEY: escapedPem,
    SUPABASE_INTERNAL_JWT_ALGORITHM: 'ES256',
    SUPABASE_INTERNAL_JWT_KEY_ID: 'pay-test-kid',
    SUPABASE_INTERNAL_JWT_ISSUER: 'https://issuer.example.test',
    SUPABASE_INTERNAL_JWT_AUDIENCE: 'authenticated',
    SUPABASE_INTERNAL_JWT_TTL_SECONDS: '60',
  };

  assert.doesNotThrow(() => validatePayInternalJwtConfig(env));
  const token = await mintPayInternalJwt(env, 'cloudflare-pem-test', 1_700_000_000);
  assert.equal(token.split('.').length, 3);
});
