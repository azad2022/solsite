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