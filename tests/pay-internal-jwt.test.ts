import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';

import {
  mintPayInternalJwt,
  PAY_INTERNAL_JWT_CLAIM,
  PAY_INTERNAL_JWT_MIN_TTL_SECONDS,
  PAY_INTERNAL_JWT_ROLE,
  PAY_INTERNAL_JWT_MAX_TTL_SECONDS,
  validatePayInternalJwtConfig,
} from '../functions/api/pay/_shared/internal-jwt.ts';

function toPem(key: Buffer): string {
  const body = key.toString('base64').match(/.{1,64}/g)?.join('\n') ?? '';
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
}

function toArrayBuffer(value: Buffer): ArrayBuffer {
  const copy = new ArrayBuffer(value.byteLength);
  new Uint8Array(copy).set(value);
  return copy;
}

function decodeBase64Url(value: string): Buffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function decodeJson(value: string): Record<string, unknown> {
  return JSON.parse(decodeBase64Url(value).toString('utf8')) as Record<string, unknown>;
}

function makeEnv(algorithm: 'ES256' | 'RS256', privateKey: Buffer, ttl?: string) {
  return {
    SUPABASE_URL: 'https://example.test',
    SUPABASE_INTERNAL_JWT_PRIVATE_KEY: toPem(privateKey),
    SUPABASE_INTERNAL_JWT_ALGORITHM: algorithm,
    SUPABASE_INTERNAL_JWT_KEY_ID: 'pay-test-kid',
    SUPABASE_INTERNAL_JWT_ISSUER: 'https://issuer.example.test',
    SUPABASE_INTERNAL_JWT_AUDIENCE: 'authenticated',
    ...(ttl === undefined ? {} : { SUPABASE_INTERNAL_JWT_TTL_SECONDS: ttl }),
  };
}

async function assertSignatureVerifies(
  token: string,
  publicKey: CryptoKey,
  algorithm: AlgorithmIdentifier | EcdsaParams,
): Promise<void> {
  const [headerPart, payloadPart, signaturePart] = token.split('.');
  assert.ok(headerPart && payloadPart && signaturePart);
  const signature = toArrayBuffer(decodeBase64Url(signaturePart));
  assert.equal(
    await crypto.subtle.verify(algorithm, publicKey, signature, new TextEncoder().encode(`${headerPart}.${payloadPart}`)),
    true,
  );
}

test('rejects missing, unsupported, and malformed production configuration', () => {
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
  assert.throws(() => validatePayInternalJwtConfig({
    SUPABASE_URL: 'https://example.test',
    SUPABASE_INTERNAL_JWT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\n@@\n-----END PRIVATE KEY-----',
    SUPABASE_INTERNAL_JWT_ALGORITHM: 'ES256',
    SUPABASE_INTERNAL_JWT_KEY_ID: 'kid',
    SUPABASE_INTERNAL_JWT_ISSUER: 'issuer',
    SUPABASE_INTERNAL_JWT_AUDIENCE: 'audience',
  }), /invalid base64 data/);
});

test('mints and verifies an ES256 JWT with only the trusted identity claims', async () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const env = makeEnv('ES256', privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer, '60');
  const now = 1_700_000_000;
  const token = await mintPayInternalJwt(env, 'merchant-user-42', now);
  const [headerPart, payloadPart, signaturePart] = token.split('.');
  assert.ok(headerPart && payloadPart && signaturePart);

  const header = decodeJson(headerPart);
  const payload = decodeJson(payloadPart);
  assert.deepEqual(header, { alg: 'ES256', typ: 'JWT', kid: 'pay-test-kid' });
  assert.equal(payload.iss, env.SUPABASE_INTERNAL_JWT_ISSUER);
  assert.equal(payload.aud, env.SUPABASE_INTERNAL_JWT_AUDIENCE);
  assert.equal(payload.iat, now);
  assert.equal(payload.exp, now + 60);
  assert.equal(payload.role, PAY_INTERNAL_JWT_ROLE);
  assert.equal(payload[PAY_INTERNAL_JWT_CLAIM], 'merchant-user-42');
  assert.deepEqual(Object.keys(payload).sort(), ['aud', 'exp', 'iat', 'iss', PAY_INTERNAL_JWT_CLAIM, 'role'].sort());
  assert.ok((payload.exp as number) - (payload.iat as number) <= PAY_INTERNAL_JWT_MAX_TTL_SECONDS);

  const publicKey = await crypto.subtle.importKey(
    'spki',
    toArrayBuffer(privateKey.export({ type: 'spki', format: 'der' }) as Buffer),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  assert.equal(decodeBase64Url(signaturePart).length, 64);
  await assertSignatureVerifies(token, publicKey, { name: 'ECDSA', hash: 'SHA-256' });
});

test('mints and verifies a real RS256 JWT', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateDer = privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer;
  const publicDer = privateKey.export({ type: 'spki', format: 'der' }) as Buffer;
  const env = makeEnv('RS256', privateDer, '60');
  const token = await mintPayInternalJwt(env, 'merchant-user-rs256', 1_700_000_000);
  const [headerPart, payloadPart] = token.split('.');
  assert.ok(headerPart && payloadPart);
  assert.deepEqual(decodeJson(headerPart), { alg: 'RS256', typ: 'JWT', kid: 'pay-test-kid' });
  assert.equal(decodeJson(payloadPart)[PAY_INTERNAL_JWT_CLAIM], 'merchant-user-rs256');

  const publicKey = await crypto.subtle.importKey(
    'spki',
    toArrayBuffer(publicDer),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  await assertSignatureVerifies(token, publicKey, { name: 'RSASSA-PKCS1-v1_5' });
});

test('enforces default and boundary TTL values', async () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const privateDer = privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer;

  const defaultEnv = makeEnv('ES256', privateDer);
  const defaultToken = await mintPayInternalJwt(defaultEnv, 'ttl-default', 1_700_000_000);
  const defaultPayload = decodeJson(defaultToken.split('.')[1]);
  assert.equal(defaultPayload.exp, 1_700_000_060);

  const minEnv = makeEnv('ES256', privateDer, String(PAY_INTERNAL_JWT_MIN_TTL_SECONDS));
  const minToken = await mintPayInternalJwt(minEnv, 'ttl-min', 1_700_000_000);
  const minPayload = decodeJson(minToken.split('.')[1]);
  assert.equal(minPayload.exp, 1_700_000_000 + PAY_INTERNAL_JWT_MIN_TTL_SECONDS);

  assert.throws(() => validatePayInternalJwtConfig({
    ...defaultEnv,
    SUPABASE_INTERNAL_JWT_TTL_SECONDS: '29',
  }), /between 30 and 300/);
  assert.throws(() => validatePayInternalJwtConfig({
    ...defaultEnv,
    SUPABASE_INTERNAL_JWT_TTL_SECONDS: String(PAY_INTERNAL_JWT_MAX_TTL_SECONDS + 1),
  }), /between 30 and 300/);
});

test('rejects unsafe internal user identities', async () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const env = makeEnv('ES256', privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer);
  await assert.rejects(() => mintPayInternalJwt(env, '', 1_700_000_000), /user id is invalid/);
  await assert.rejects(() => mintPayInternalJwt(env, 'line\nbreak', 1_700_000_000), /unsupported characters/);
  await assert.rejects(() => mintPayInternalJwt(env, 'کاربر', 1_700_000_000), /unsupported characters/);
  await assert.rejects(() => mintPayInternalJwt(env, 'x'.repeat(257), 1_700_000_000), /user id is invalid/);
});
