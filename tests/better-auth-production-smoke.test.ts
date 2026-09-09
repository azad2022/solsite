import assert from 'node:assert/strict';
import { test } from 'node:test';

test('production Better Auth route is reachable and does not fail during initialization', async () => {
  const response = await fetch('https://solmint.ir/api/auth/get-session', {
    method: 'GET',
    redirect: 'manual',
    headers: { Accept: 'application/json' },
  });
  const body = await response.text();
  console.log(`[auth-production-smoke] status=${response.status} body=${body.slice(0, 500)}`);
  assert.ok(response.status < 500, `production Better Auth route returned ${response.status}: ${body.slice(0, 500)}`);
});
