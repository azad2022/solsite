import assert from 'node:assert/strict';
import test from 'node:test';

const ORIGIN = (process.env.SOLMINT_PAY_PRODUCTION_ORIGIN || 'https://solmint.ir').replace(/\/$/, '');
const EMAIL = (process.env.PAY_E2E_EMAIL || '').trim();
const PASSWORD = process.env.PAY_E2E_PASSWORD || '';
const MERCHANT_ID = (process.env.PAY_E2E_MERCHANT_ID || '').trim();
const OTHER_MERCHANT_ID = (process.env.PAY_E2E_OTHER_MERCHANT_ID || '').trim();
const TIMEOUT_MS = 20_000;

function requireConfig(): void {
  const missing = [
    ['PAY_E2E_EMAIL', EMAIL],
    ['PAY_E2E_PASSWORD', PASSWORD],
    ['PAY_E2E_MERCHANT_ID', MERCHANT_ID],
    ['PAY_E2E_OTHER_MERCHANT_ID', OTHER_MERCHANT_ID],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Missing controlled Pay E2E configuration: ${missing.join(', ')}`);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  let value: unknown;
  try { value = text ? JSON.parse(text) : {}; } catch { throw new Error(`Expected JSON response (status ${response.status}).`); }
  assert.equal(typeof value, 'object');
  assert.notEqual(value, null);
  return value as Record<string, unknown>;
}

function cookieHeader(response: Response): string {
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  const pairs = cookies.map(value => value.split(';', 1)[0]).filter(Boolean);
  if (pairs.length) return pairs.join('; ');
  const fallback = response.headers.get('set-cookie') || '';
  return fallback.split(/,(?=[^;,]+=)/).map(value => value.split(';', 1)[0]).filter(Boolean).join('; ');
}

async function request(path: string, init: RequestInit = {}, cookie = ''): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    headers.set('Origin', ORIGIN);
    if (cookie) headers.set('Cookie', cookie);
    return await fetch(`${ORIGIN}${path}`, { ...init, headers, signal: controller.signal, redirect: 'manual' });
  } finally { clearTimeout(timer); }
}

async function signIn(): Promise<string> {
  const response = await request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await readJson(response);
  assert.equal(response.status, 200, `Better Auth sign-in failed with ${response.status}.`);
  assert.ok(body.user && typeof body.user === 'object', 'Better Auth sign-in must return a user.');
  const cookie = cookieHeader(response);
  assert.ok(cookie, 'Better Auth sign-in did not return a session cookie.');
  return cookie;
}

async function apiKeyRequest(path: string, init: RequestInit, cookie: string): Promise<{ response: Response; body: Record<string, unknown> }> {
  const response = await request(path, init, cookie);
  return { response, body: await readJson(response) };
}

function idempotencyKey(label: string): string { return `${label}-${crypto.randomUUID()}`; }

function apiKeyId(body: Record<string, unknown>): string {
  const apiKey = body.apiKey;
  assert.ok(apiKey && typeof apiKey === 'object');
  const id = (apiKey as Record<string, unknown>).id;
  assert.equal(typeof id, 'string');
  return id;
}

function apiKeySecret(body: Record<string, unknown>): string {
  const secret = body.secret;
  assert.equal(typeof secret, 'string');
  assert.match(secret, /^sk_pay_[A-Za-z0-9_-]{64,}$/);
  return secret;
}

function assertNoPlaintextSecret(payload: unknown): void {
  const text = JSON.stringify(payload);
  assert.equal(/"secret"\s*:\s*"sk_pay_[A-Za-z0-9_-]{64,}"/.test(text), false, 'Response must not contain a plaintext API credential field.');
  assert.equal(/sk_pay_[A-Za-z0-9_-]{64,}/.test(text), false, 'Response must not contain a plaintext API credential.');
}

async function revoke(cookie: string, merchantId: string, keyId: string): Promise<void> {
  const { response, body } = await apiKeyRequest(`/api/pay/v1/merchants/${encodeURIComponent(merchantId)}/api-keys/${encodeURIComponent(keyId)}`, { method: 'DELETE' }, cookie);
  assert.equal(response.status, 200);
  const apiKey = body.apiKey as Record<string, unknown> | undefined;
  assert.equal(apiKey?.status, 'revoked');
}

async function assertCredentialRejected(secret: string, expectedStatus = 401): Promise<void> {
  const response = await request('/api/pay/v1/payment-intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey('credential-rejection'),
    },
    body: JSON.stringify({}),
  });
  const body = await readJson(response);
  assert.equal(response.status, expectedStatus);
  assert.equal(body.success, false);
  assert.equal(body.code, expectedStatus === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED');
}

test('controlled production API-key lifecycle remains server-authoritative', async () => {
  requireConfig();
  const cookie = await signIn();

  const me = await request('/api/users/me', {}, cookie);
  assert.equal(me.status, 200);

  const first = await apiKeyRequest(`/api/pay/v1/merchants/${encodeURIComponent(MERCHANT_ID)}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey('lifecycle-create') },
    body: JSON.stringify({ name: 'pay-e2e-lifecycle', scopes: ['payment.create'], expiresAt: null }),
  }, cookie);
  assert.equal(first.response.status, 201);
  const firstSecret = apiKeySecret(first.body);
  const firstKeyId = apiKeyId(first.body);

  const list = await apiKeyRequest(`/api/pay/v1/merchants/${encodeURIComponent(MERCHANT_ID)}/api-keys`, {}, cookie);
  assert.equal(list.response.status, 200);
  assertNoPlaintextSecret(list.body);
  assert.ok(Array.isArray(list.body.apiKeys));
  assert.ok((list.body.apiKeys as unknown[]).some(item => (item as Record<string, unknown>).id === firstKeyId));

  const replayKey = idempotencyKey('lifecycle-replay');
  const replayRequest: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': replayKey },
    body: JSON.stringify({ name: 'pay-e2e-replay', scopes: ['payment.create'], expiresAt: null }),
  };
  const replayFirst = await apiKeyRequest(`/api/pay/v1/merchants/${encodeURIComponent(MERCHANT_ID)}/api-keys`, replayRequest, cookie);
  assert.equal(replayFirst.response.status, 201);
  apiKeySecret(replayFirst.body);
  const replayId = apiKeyId(replayFirst.body);
  const replaySecond = await apiKeyRequest(`/api/pay/v1/merchants/${encodeURIComponent(MERCHANT_ID)}/api-keys`, replayRequest, cookie);
  assert.equal(replaySecond.response.status, 200);
  assertNoPlaintextSecret(replaySecond.body);
  assert.equal(apiKeyId(replaySecond.body), replayId);

  const concurrentKey = idempotencyKey('lifecycle-concurrent');
  const concurrentInit: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': concurrentKey },
    body: JSON.stringify({ name: 'pay-e2e-concurrent', scopes: ['payment.create'], expiresAt: null }),
  };
  const concurrent = await Promise.all([
    apiKeyRequest(`/api/pay/v1/merchants/${encodeURIComponent(MERCHANT_ID)}/api-keys`, concurrentInit, cookie),
    apiKeyRequest(`/api/pay/v1/merchants/${encodeURIComponent(MERCHANT_ID)}/api-keys`, concurrentInit, cookie),
  ]);
  assert.deepEqual(concurrent.map(item => item.response.status).sort((a, b) => a - b), [200, 201]);
  assert.equal(concurrent.filter(item => typeof item.body.secret === 'string').length, 1);
  concurrent.forEach(item => { if (item.response.status === 200) assertNoPlaintextSecret(item.body); });
  const concurrentIds = concurrent.map(item => apiKeyId(item.body));
  assert.equal(new Set(concurrentIds).size, 1);
  const concurrentId = concurrentIds[0];

  const wrongScope = await apiKeyRequest(`/api/pay/v1/merchants/${encodeURIComponent(MERCHANT_ID)}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey('lifecycle-wrong-scope') },
    body: JSON.stringify({ name: 'pay-e2e-wrong-scope', scopes: ['payment.read'], expiresAt: null }),
  }, cookie);
  assert.equal(wrongScope.response.status, 400);
  assert.equal(wrongScope.body.code, 'INVALID_API_KEY_SCOPES');

  const crossMerchant = await apiKeyRequest(`/api/pay/v1/merchants/${encodeURIComponent(OTHER_MERCHANT_ID)}/api-keys`, {}, cookie);
  assert.equal(crossMerchant.response.status, 403);
  assert.equal(crossMerchant.body.code, 'FORBIDDEN');

  const rotate = await apiKeyRequest(`/api/pay/v1/merchants/${encodeURIComponent(MERCHANT_ID)}/api-keys/${encodeURIComponent(firstKeyId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey('lifecycle-rotate') },
    body: JSON.stringify({ name: 'pay-e2e-rotated', scopes: ['payment.create'], expiresAt: null }),
  }, cookie);
  assert.equal(rotate.response.status, 201);
  const rotatedSecret = apiKeySecret(rotate.body);
  const rotatedId = apiKeyId(rotate.body);
  assert.notEqual(rotatedSecret, firstSecret);
  assert.notEqual(rotatedId, firstKeyId);
  await assertCredentialRejected(firstSecret);

  const rotateReplayKey = idempotencyKey('lifecycle-rotate-replay');
  const rotateReplayInit: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': rotateReplayKey },
    body: JSON.stringify({ name: 'pay-e2e-rotate-replay', scopes: ['payment.create'], expiresAt: null }),
  };
  const rotateReplayFirst = await apiKeyRequest(`/api/pay/v1/merchants/${encodeURIComponent(MERCHANT_ID)}/api-keys/${encodeURIComponent(rotatedId)}`, rotateReplayInit, cookie);
  assert.equal(rotateReplayFirst.response.status, 201);
  const replacementId = apiKeyId(rotateReplayFirst.body);
  apiKeySecret(rotateReplayFirst.body);
  const rotateReplaySecond = await apiKeyRequest(`/api/pay/v1/merchants/${encodeURIComponent(MERCHANT_ID)}/api-keys/${encodeURIComponent(rotatedId)}`, rotateReplayInit, cookie);
  assert.equal(rotateReplaySecond.response.status, 200);
  assertNoPlaintextSecret(rotateReplaySecond.body);
  assert.equal(apiKeyId(rotateReplaySecond.body), replacementId);

  const revokeCoverage = await apiKeyRequest(`/api/pay/v1/merchants/${encodeURIComponent(MERCHANT_ID)}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey('lifecycle-revoke') },
    body: JSON.stringify({ name: 'pay-e2e-revoke', scopes: ['payment.create'], expiresAt: null }),
  }, cookie);
  assert.equal(revokeCoverage.response.status, 201);
  const revokeId = apiKeyId(revokeCoverage.body);
  const revokeSecret = apiKeySecret(revokeCoverage.body);
  await revoke(cookie, MERCHANT_ID, revokeId);
  await revoke(cookie, MERCHANT_ID, revokeId);
  await assertCredentialRejected(revokeSecret);

  const expired = await apiKeyRequest(`/api/pay/v1/merchants/${encodeURIComponent(MERCHANT_ID)}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey('lifecycle-expiry') },
    body: JSON.stringify({ name: 'pay-e2e-expiring', scopes: ['payment.create'], expiresAt: new Date(Date.now() + 65_000).toISOString() }),
  }, cookie);
  assert.equal(expired.response.status, 201);
  const expiredId = apiKeyId(expired.body);
  const expiredSecret = apiKeySecret(expired.body);
  await new Promise(resolve => setTimeout(resolve, 70_000));
  await assertCredentialRejected(expiredSecret);

  for (const keyId of [replayId, concurrentId, replacementId, expiredId, rotatedId]) {
    await revoke(cookie, MERCHANT_ID, keyId).catch(() => undefined);
  }
});
