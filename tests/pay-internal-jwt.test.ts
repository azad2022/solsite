import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';

import {
  mintPayInternalJwt,
  PAY_INTERNAL_JWT_CLAIM,
  PAY_INTERNAL_JWT_ROLE,
  PAY_INTERNAL_JWT_MAX_TTL_SECONDS,
  validatePayInternalJwtConfig,
} from '../functions/api/pay/_shared/internal-jwt.ts';

function toPem(key: Buffer): string {
  const body = key.toString('base64').match(/.{1,64}/g)?.join('\n') ?? '';
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

test('rejects missing or malformed production configuration', () => {
  assert.throws(() => validatePayInternalJwtConfig({}), /SUPABASE_URL is required/);
  assert.throws(() => validatePayInternalJwtConfig({ SUPABASE_URL: 'https://example.test' }), /PRIVATE_KEY/);
  assert.throws(() => validatePayInternalJwtConfig({
    SUPABASE_URL: 'https://example.test',
    SUPABASE_INTERNAL_JWT_PRIVATE_KEY: 'not-a-key',
    SUPABASE_INTERNAL_JWT_ALGORITHM: 'HS256',
    SUPABASE_INTERNAL_JWT_KEY_ID: 'kid',
    SUPABASE_INTERNAL_JWT_ISSUER: 'issuer',
    SUPABASE_INTERNAL_JWT_AUDIENCE: 'audience',
  }), /ES256 or RS256/);
});

test('mints a short-lived ES256 JWT with only the trusted identity claims', async () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const env = {
    SUPABASE_URL: 'https://example.test',
    SUPABASE_INTERNAL_JWT_PRIVATE_KEY: toPem(privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer),
    SUPABASE_INTERNAL_JWT_ALGORITHM: 'ES256',
    SUPABASE_INTERNAL_JWT_KEY_ID: 'pay-test-kid',
    SUPABASE_INTERNAL_JWT_ISSUER: 'https://issuer.example.test',
    SUPABASE_INTERNAL_JWT_AUDIENCE: 'authenticated',
    SUPABASE_INTERNAL_JWT_TTL_SECONDS: '60',
  };
  const now = 1_700_000_000;
  const token = await mintPayInternalJwt(env, 'merchant-user-42', now);
  const [headerPart, payloadPart, signaturePart] = token.split('.');
  assert.ok(headerPart && payloadPart && signaturePart);

  const header = JSON.parse(decodeBase64Url(headerPart)) as Record<string, unknown>;
  const payload = JSON.parse(decodeBase64Url(payloadPart)) as Record<string, unknown>;
  assert.deepEqual(header, { alg: 'ES256', typ: 'JWT', kid: 'pay-test-kid' });
  assert.equal(payload.iss, env.SUPABASE_INTERNAL_JWT_ISSUER);
  assert.equal(payload.aud, env.SUPABASE_INTERNAL_JWT_AUDIENCE);
  assert.equal(payload.iat, now);
  assert.equal(payload.exp, now + 60);
  assert.equal(payload.role, PAY_INTERNAL_JWT_ROLE);
  assert.equal(payload[PAY_INTERNAL_JWT_CLAIM], 'merchant-user-42');
  assert.deepEqual(Object.keys(payload).sort(), ['aud', 'exp', 'iat', 'iss', PAY_INTERNAL_JWT_CLAIM, 'role'].sort());
  assert.ok(payload.exp as number - (payload.iat as number) <= PAY_INTERNAL_JWT_MAX_TTL_SECONDS);

  const publicKey = await crypto.subtle.importKey(
    'spki',
    privateKey.export({ type: 'spki', format: 'der' }),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  const signingInput = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const signature = Buffer.from(signaturePart.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (signaturePart.length % 4)) % 4), 'base64');
  assert.equal(signature.length, 64);
  assert.equal(
    await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, signature, signingInput),
    true,
  );
});

test('enforces a maximum five-minute TTL', () => {
  assert.throws(() => validatePayInternalJwtConfig({
    SUPABASE_URL: 'https://example.test',
    SUPABASE_INTERNAL_JWT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nAA==\n-----END PRIVATE KEY-----',
    SUPABASE_INTERNAL_JWT_ALGORITHM: 'ES256',
    SUPABASE_INTERNAL_JWT_KEY_ID: 'kid',
    SUPABASE_INTERNAL_JWT_ISSUER: 'issuer',
    SUPABASE_INTERNAL_JWT_AUDIENCE: 'audience',
    SUPABASE_INTERNAL_JWT_TTL_SECONDS: String(PAY_INTERNAL_JWT_MAX_TTL_SECONDS + 1),
  }), /between 30 and 300/);
});
