import assert from 'node:assert/strict';
import test from 'node:test';

const liveBaseUrl = process.env.PAY_LIVE_SMOKE_BASE_URL?.trim();

test('Pay live smoke suite requires PAY_LIVE_SMOKE_BASE_URL', { skip: !liveBaseUrl }, async () => {
  const baseUrl = liveBaseUrl!.replace(/\/$/, '');

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

  await t();

  async function t(): Promise<void> {
    const merchantResponse = await request('/api/pay/v1/merchants');
    assert.equal(merchantResponse.status, 401, 'Pay merchant endpoint must require a valid SolMint session');
    assert.equal(merchantResponse.headers.get('x-pay-request-id')?.startsWith('PAY-'), true);
    const merchantBody = await merchantResponse.json() as { code?: string; success?: boolean };
    assert.equal(merchantBody.success, false);
    assert.equal(merchantBody.code, 'UNAUTHORIZED');

    const intentResponse = await request('/api/pay/v1/payment-intents', {
      method: 'POST',
      body: JSON.stringify({ amountAtomic: '1000000', asset: 'SOL', feePayer: 'merchant' }),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'live-smoke-unauthenticated' },
    });
    assert.equal(intentResponse.status, 401, 'Payment creation must require Pay API credentials');
    const intentBody = await intentResponse.json() as { code?: string; success?: boolean };
    assert.equal(intentBody.success, false);
    assert.equal(intentBody.code, 'UNAUTHORIZED');

    const malformedResponse = await request('/api/pay/v1/payment-intents/not-a-uuid');
    assert.equal(malformedResponse.status, 400);
    assert.equal(malformedResponse.headers.get('content-type')?.startsWith('application/json'), true);
    const malformedBody = await malformedResponse.json() as { error?: { code?: string }; success?: boolean };
    assert.equal(malformedBody.success, false);
    assert.equal(malformedBody.error?.code, 'PAYMENT_INTENT_ID_INVALID');
  }
});
