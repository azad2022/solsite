import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBetterAuthRuntime } from '../functions/api/auth/_instance';

test('Better Auth runtime initializes with the production transport shape', async () => {
  const runtime = createBetterAuthRuntime({
    NODE_ENV: 'test',
    BETTER_AUTH_SECRET: 'test-secret-that-is-longer-than-thirty-two-characters',
    BETTER_AUTH_URL: 'https://solmint.ir',
    BETTER_AUTH_TRUSTED_ORIGINS: 'https://solmint.ir',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SECRET_KEY: 'test-supabase-secret-key',
  });

  try {
    assert.ok(runtime.auth);
    assert.ok(runtime.database);
    assert.ok(runtime.application);
  } finally {
    await runtime.close();
  }
});
