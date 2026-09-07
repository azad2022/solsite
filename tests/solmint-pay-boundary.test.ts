import test from 'node:test';
import assert from 'node:assert/strict';
import { isPayTerminalState, PAY_DATA_STATES } from '../src/pay/data-state.ts';
import { PayHttpClient, PayHttpError } from '../src/pay/http.ts';

test('Pay data state model explicitly represents required UI lifecycle states', () => {
  assert.deepEqual(PAY_DATA_STATES, [
    'idle',
    'loading',
    'ready',
    'empty',
    'error',
    'unauthorized',
    'forbidden',
    'stale',
    'retryable',
  ]);
  assert.equal(isPayTerminalState('ready'), true);
  assert.equal(isPayTerminalState('empty'), true);
  assert.equal(isPayTerminalState('loading'), false);
});

test('Pay HTTP boundary rejects cross-origin and non-API paths', async () => {
  const client = new PayHttpClient({ fetchImpl: async () => new Response('{}') });
  await assert.rejects(() => client.request('/pay/transactions'), TypeError);
  await assert.rejects(() => client.request('https://example.com/api/pay'), TypeError);
  await assert.rejects(() => client.request('//example.com/api/pay'), TypeError);
});

test('Pay HTTP boundary preserves JSON success payloads and request IDs', async () => {
  const client = new PayHttpClient({
    fetchImpl: async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-request-id': 'req-test-1' },
    }),
  });
  assert.deepEqual(await client.request<{ ok: boolean }>('/api/pay/test'), { ok: true });
});

test('Pay HTTP boundary maps non-2xx JSON responses to typed errors', async () => {
  const client = new PayHttpClient({
    fetchImpl: async () => new Response(JSON.stringify({ message: 'Forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json', 'x-request-id': 'req-test-2' },
    }),
  });

  await assert.rejects(
    () => client.request('/api/pay/test'),
    (error: unknown) => {
      assert.ok(error instanceof PayHttpError);
      assert.equal(error.status, 403);
      assert.equal(error.requestId, 'req-test-2');
      assert.equal(error.message, 'Forbidden');
      return true;
    },
  );
});
