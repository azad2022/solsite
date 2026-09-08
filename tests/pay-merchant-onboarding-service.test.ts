import assert from 'node:assert/strict';
import test from 'node:test';
import { PayHttpError } from '../src/pay/http';

test('Pay onboarding transport remains same-origin', async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const fetchImpl = async (path: string, init?: RequestInit) => {
    calls.push({ path, init });
    return new Response(JSON.stringify({ success: true, merchant: {
      id: 'merchant-1', owner_user_id: 'user-1', business_name: 'Test Store', slug: 'test-store', status: 'pending', created_at: '2026-09-08T00:00:00Z', updated_at: '2026-09-08T00:00:00Z',
    }}), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const { createMyMerchant } = await import('../src/pay/services/merchantOnboardingService');
  const module = await import('../src/pay/http');
  const original = module.defaultPayHttpClient;
  void original;
  assert.equal(typeof createMyMerchant, 'function');
  assert.deepEqual(calls, []);

  const client = new module.PayHttpClient({ fetchImpl });
  const payload = await client.request<{ success: boolean }>('/api/pay/v1/merchants', { method: 'GET' });
  assert.equal(payload.success, true);
  assert.equal(calls[0]?.path, '/api/pay/v1/merchants');
  assert.equal(calls[0]?.init?.credentials, 'include');
});

test('Pay HTTP rejects cross-origin and scheme URLs', async () => {
  const client = new (await import('../src/pay/http')).PayHttpClient({ fetchImpl: async () => new Response('{}') });
  await assert.rejects(() => client.request('https://example.com/api/pay'), TypeError);
  await assert.rejects(() => client.request('//example.com/api/pay'), TypeError);
});

test('Pay HTTP preserves structured HTTP failures', async () => {
  const client = new (await import('../src/pay/http')).PayHttpClient({ fetchImpl: async () => new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json', 'x-request-id': 'r-1' } }) });
  await assert.rejects(
    () => client.request('/api/pay/v1/merchants'),
    (error: unknown) => error instanceof PayHttpError && error.status === 401 && error.requestId === 'r-1',
  );
});
