import assert from 'node:assert/strict';
import test from 'node:test';

const baseUrl = (process.env.PAY_LIVE_SMOKE_BASE_URL || 'https://solmint.ir').replace(/\/$/, '');

async function request(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    ...init,
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-store',
      ...(init?.headers || {}),
    },
  });
}

test('Pay merchant session boundary is live and unauthenticated access is denied', async () => {
  const response = await request('/api/pay/v1/merchants');
  assert.notEqual(response.status, 404, 'Pay route must not be missing');
  assert.equal(response.status, 401, 'Pay merchant endpoint must require a valid SolMint session');
  assert.equal(response.headers.get('x-pay-request-id')?.startsWith('PAY-'), true);
  const body = await response.json() as { code?: string; success?: boolean };
  assert.equal(body.success, false);
  assert.equal(body.code, 'UNAUTHORIZED');
});

test('Pay payment-intent API is live and rejects unauthenticated creation', async () => {
  const response = await request('/api/pay/v1/payment-intents', {
    method: 'POST',
    body: JSON.stringify({ amountAtomic: '1000000', asset: 'SOL', feePayer: 'merchant' }),
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'live-smoke-unauthenticated' },
  });
  assert.notEqual(response.status, 404, 'Pay payment-intents route must not be missing');
  assert.equal(response.status, 401, 'Payment creation must require Pay API credentials');
  const body = await response.json() as { code?: string; success?: boolean };
  assert.equal(body.success, false);
  assert.equal(body.code, 'UNAUTHORIZED');
});

test('Public Payment Intent route enforces UUID input before database access', async () => {
  const response = await request('/api/pay/v1/payment-intents/not-a-uuid');
  assert.equal(response.status, 400);
  const body = await response.json() as { code?: string; success?: boolean };
  assert.equal(body.success, false);
  assert.equal(body.code, 'PAYMENT_INTENT_ID_INVALID');
});
