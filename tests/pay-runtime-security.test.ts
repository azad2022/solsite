import assert from 'node:assert/strict';
import test from 'node:test';
import { supabaseRequest } from '../functions/api/pay/_shared/runtime';

test('Supabase upstream error logging excludes the response body', async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const logMessages: string[] = [];
  const leakedSecret = 'sk_pay_test_secret_should_never_be_logged';

  globalThis.fetch = (async () => new Response(JSON.stringify({ error: leakedSecret }), { status: 500, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  console.error = (...args: unknown[]) => logMessages.push(args.map(String).join(' '));

  try {
    await assert.rejects(
      () => supabaseRequest({ SUPABASE_URL: 'https://example.invalid', SUPABASE_SECRET_KEY: 'server-only' }, '/rest/v1/pay_api_keys'),
      (error: unknown) => error instanceof Error && error.message === 'Pay data service is unavailable.',
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }

  assert.equal(logMessages.length, 1);
  assert.match(logMessages[0], /"scope":"pay:supabase"/);
  assert.match(logMessages[0], /"status":500/);
  assert.equal(logMessages.join('\n').includes(leakedSecret), false);
});
