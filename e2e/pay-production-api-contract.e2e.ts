import assert from 'node:assert/strict';
import test from 'node:test';

const ORIGIN = (process.env.SOLMINT_PAY_PRODUCTION_ORIGIN || 'https://solmint.ir').replace(/\/$/, '');
const TIMEOUT_MS = 15_000;

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${ORIGIN}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init.headers,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  let value: unknown;
  try {
    value = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Expected JSON response, received: ${text.slice(0, 300)}`);
  }
  assert.equal(typeof value, 'object');
  assert.notEqual(value, null);
  return value as Record<string, unknown>;
}

test('production Pay API rejects malformed Payment Intent IDs with stable contract', async () => {
  const response = await request('/api/pay/v1/payment-intents/not-a-uuid');
  assert.equal(response.status, 400);
  assert.match(response.headers.get('content-type') || '', /application\/json/i);
  assert.match(response.headers.get('cache-control') || '', /no-store/i);
  const body = await readJson(response);
  assert.equal(body.success, false);
  assert.equal(typeof body.error, 'object');
  assert.notEqual(body.error, null);
  const error = body.error as Record<string, unknown>;
  assert.equal(error.code, 'PAYMENT_INTENT_ID_INVALID');
  assert.equal(typeof error.message, 'string');
});

test('production Pay API requires an authenticated SolMint session for merchant reads', async () => {
  const response = await request('/api/pay/v1/merchants');
  assert.equal(response.status, 401);
  assert.match(response.headers.get('content-type') || '', /application\/json/i);
  const body = await readJson(response);
  assert.equal(body.success, false);
  assert.equal(body.code, 'UNAUTHORIZED');
  assert.equal(typeof body.requestId, 'string');
});

test('production Pay API rejects forged bearer credentials for merchant reads', async () => {
  const response = await request('/api/pay/v1/merchants', {
    headers: { Authorization: 'Bearer forged.invalid.token' },
  });
  assert.equal(response.status, 401);
  const body = await readJson(response);
  assert.equal(body.success, false);
  assert.equal(body.code, 'UNAUTHORIZED');
  assert.equal(typeof body.requestId, 'string');
});

test('production Pay API rejects untrusted origin before merchant authentication', async () => {
  const response = await request('/api/pay/v1/merchants', {
    method: 'POST',
    headers: {
      Origin: 'https://attacker.example',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ businessName: 'Smoke Merchant', slug: 'smoke-merchant' }),
  });
  assert.equal(response.status, 403);
  const body = await readJson(response);
  assert.equal(body.success, false);
  assert.equal(body.code, 'ORIGIN_FORBIDDEN');
  assert.equal(typeof body.requestId, 'string');
});

test('production Pay API fails closed when merchant creation has no origin header', async () => {
  const response = await request('/api/pay/v1/merchants', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ businessName: 'Smoke Merchant', slug: 'smoke-merchant' }),
  });
  assert.equal(response.status, 403);
  const body = await readJson(response);
  assert.equal(body.success, false);
  assert.equal(body.code, 'ORIGIN_FORBIDDEN');
  assert.equal(typeof body.requestId, 'string');
});

test('production Pay API fails closed when wallet challenge issuance has no origin header', async () => {
  const response = await request('/api/pay/v1/merchants/not-a-real-merchant/wallet-challenges', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ walletAddress: '11111111111111111111111111111111' }),
  });
  assert.equal(response.status, 403);
  const body = await readJson(response);
  assert.equal(body.success, false);
  assert.equal(body.code, 'ORIGIN_FORBIDDEN');
  assert.equal(typeof body.requestId, 'string');
});

test('production Pay API requires an API credential for payment-intent creation', async () => {
  const response = await request('/api/pay/v1/payment-intents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'production-contract-smoke-unauthorized',
    },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 401);
  assert.match(response.headers.get('cache-control') || '', /no-store/i);
  const body = await readJson(response);
  assert.equal(body.success, false);
  assert.equal(body.code, 'UNAUTHORIZED');
  assert.equal(typeof body.requestId, 'string');
});

test('production Pay Invoice read API requires an authenticated session', async () => {
  const response = await request('/api/pay/v1/invoices?merchantId=00000000-0000-4000-8000-000000000001');
  assert.equal(response.status, 401);
  const body = await readJson(response);
  assert.equal(body.success, false);
  assert.equal(body.code, 'UNAUTHORIZED');
  assert.equal(typeof body.requestId, 'string');
});

test('production Pay Payment Link read API requires an authenticated session', async () => {
  const response = await request('/api/pay/v1/payment-links?merchantId=00000000-0000-4000-8000-000000000001');
  assert.equal(response.status, 401);
  const body = await readJson(response);
  assert.equal(body.success, false);
  assert.equal(body.code, 'UNAUTHORIZED');
  assert.equal(typeof body.requestId, 'string');
});

test('production Pay Referral read API requires an authenticated session', async () => {
  const response = await request('/api/pay/v1/referrals');
  assert.equal(response.status, 401);
  const body = await readJson(response);
  assert.equal(body.success, false);
  assert.equal(body.code, 'UNAUTHORIZED');
  assert.equal(typeof body.requestId, 'string');
});

test('production Pay Customers read API requires an authenticated session', async () => {
  const response = await request('/api/pay/v1/customers?merchantId=00000000-0000-4000-8000-000000000001');
  assert.equal(response.status, 401);
  const body = await readJson(response);
  assert.equal(body.success, false);
  assert.equal(body.code, 'UNAUTHORIZED');
  assert.equal(typeof body.requestId, 'string');
});

test('production Pay Reports read API requires an authenticated session', async () => {
  const response = await request('/api/pay/v1/reports?merchantId=00000000-0000-4000-8000-000000000001&from=2026-09-01T00:00:00.000Z&to=2026-09-02T00:00:00.000Z');
  assert.equal(response.status, 401);
  const body = await readJson(response);
  assert.equal(body.success, false);
  assert.equal(body.code, 'UNAUTHORIZED');
  assert.equal(typeof body.requestId, 'string');
});

test('production Pay API requires an authenticated session for merchant API-key listing', async () => {
  const response = await request('/api/pay/v1/merchants/00000000-0000-4000-8000-000000000001/api-keys', {
    headers: { Origin: ORIGIN },
  });
  assert.equal(response.status, 401);
  assert.match(response.headers.get('content-type') || '', /application\/json/i);
  const body = await readJson(response);
  assert.equal(body.success, false);
  assert.equal(body.code, 'UNAUTHORIZED');
  assert.equal(typeof body.requestId, 'string');
});

test('production Pay API requires an authenticated session for API-key creation', async () => {
  const response = await request('/api/pay/v1/merchants/00000000-0000-4000-8000-000000000001/api-keys', {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'production-contract-smoke-api-key-unauthorized',
    },
    body: JSON.stringify({ name: 'contract-smoke', scopes: ['payment.create'], expiresAt: null }),
  });
  assert.equal(response.status, 401);
  assert.match(response.headers.get('cache-control') || '', /no-store/i);
  const body = await readJson(response);
  assert.equal(body.success, false);
  assert.equal(body.code, 'UNAUTHORIZED');
  assert.equal(typeof body.requestId, 'string');
});

test('production Pay API-key listing rejects an untrusted origin before authentication', async () => {
  const response = await request('/api/pay/v1/merchants/00000000-0000-4000-8000-000000000001/api-keys', {
    headers: { Origin: 'https://attacker.example' },
  });
  assert.equal(response.status, 403);
  const body = await readJson(response);
  assert.equal(body.success, false);
  assert.equal(body.code, 'ORIGIN_FORBIDDEN');
  assert.equal(typeof body.requestId, 'string');
});

test('production Pay API-key creation rejects an untrusted origin before authentication', async () => {
  const response = await request('/api/pay/v1/merchants/00000000-0000-4000-8000-000000000001/api-keys', {
    method: 'POST',
    headers: {
      Origin: 'https://attacker.example',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'production-contract-smoke-api-key-origin',
    },
    body: JSON.stringify({ name: 'contract-smoke', scopes: ['payment.create'], expiresAt: null }),
  });
  assert.equal(response.status, 403);
  const body = await readJson(response);
  assert.equal(body.success, false);
  assert.equal(body.code, 'ORIGIN_FORBIDDEN');
  assert.equal(typeof body.requestId, 'string');
});
