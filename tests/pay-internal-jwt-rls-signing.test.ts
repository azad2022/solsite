import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { mintPayInternalJwt, validatePayInternalJwtConfig, type PayInternalJwtEnv } from '../functions/api/pay/_shared/internal-jwt';

function pemForKeyPair(algorithm: 'ES256' | 'RS256'): { privateKey: string; publicKey: string } {
  if (algorithm === 'ES256') {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    return {
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    };
  }
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

function base64UrlJson(value: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
}

for (const algorithm of ['ES256', 'RS256'] as const) {
  test(`mints a valid short-lived ${algorithm} JWT with minimal identity claims`, async () => {
    const keys = pemForKeyPair(algorithm);
    const env: PayInternalJwtEnv = {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_INTERNAL_JWT_PRIVATE_KEY: keys.privateKey,
      SUPABASE_INTERNAL_JWT_ALGORITHM: algorithm,
      SUPABASE_INTERNAL_JWT_KEY_ID: 'test-kid',
      SUPABASE_INTERNAL_JWT_ISSUER: 'https://example.supabase.co/auth/v1',
      SUPABASE_INTERNAL_JWT_AUDIENCE: 'authenticated',
      SUPABASE_INTERNAL_JWT_TTL_SECONDS: '60',
    };

    const now = 1_800_000_000;
    const token = await mintPayInternalJwt(env, 'application-user-123', now);
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    assert.ok(encodedHeader && encodedPayload && encodedSignature);

    const header = base64UrlJson(encodedHeader);
    const payload = base64UrlJson(encodedPayload);
    assert.deepEqual(header, { alg: algorithm, typ: 'JWT', kid: 'test-kid' });
    assert.equal(payload.iss, env.SUPABASE_INTERNAL_JWT_ISSUER);
    assert.equal(payload.aud, 'authenticated');
    assert.equal(payload.iat, now);
    assert.equal(payload.exp, now + 60);
    assert.equal(payload.role, 'authenticated');
    assert.equal(payload.solmint_user_id, 'application-user-123');

    const publicKey = await crypto.subtle.importKey(
      'spki',
      Buffer.from(keys.publicKey.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s+/g, ''), 'base64'),
      algorithm === 'ES256' ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const signature = Buffer.from(encodedSignature, 'base64url');
    const valid = await crypto.subtle.verify(
      algorithm === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      signature,
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
    assert.equal(valid, true);
  });
}

test('rejects missing or unsafe production configuration', () => {
  assert.throws(() => validatePayInternalJwtConfig({}), /SUPABASE_URL/);
  assert.throws(() => validatePayInternalJwtConfig({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_INTERNAL_JWT_PRIVATE_KEY: 'not-pem', SUPABASE_INTERNAL_JWT_ALGORITHM: 'HS256', SUPABASE_INTERNAL_JWT_KEY_ID: 'kid', SUPABASE_INTERNAL_JWT_ISSUER: 'iss', SUPABASE_INTERNAL_JWT_AUDIENCE: 'aud' }), /ES256 or RS256/);
});
