import assert from 'node:assert/strict';
import { test } from 'node:test';

async function readResponse(response: Response): Promise<string> {
  return (await response.text()).slice(0, 800);
}

test('production Better Auth session route initializes', async () => {
  const response = await fetch('https://solmint.ir/api/auth/get-session', {
    method: 'GET',
    redirect: 'manual',
    headers: { Accept: 'application/json' },
  });
  const body = await readResponse(response);
  console.log(`[auth-production-smoke] get-session status=${response.status} body=${body}`);
  assert.ok(response.status < 500, `get-session returned ${response.status}: ${body}`);
});

test('production Better Auth rejects invalid signup input without a server failure', async () => {
  const response = await fetch('https://solmint.ir/api/auth/sign-up/email', {
    method: 'POST',
    redirect: 'manual',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'invalid-email', name: 'Smoke Test', password: 'x', username: 'smoke_test_invalid' }),
  });
  const body = await readResponse(response);
  console.log(`[auth-production-smoke] sign-up/email status=${response.status} body=${body}`);
  assert.ok(response.status < 500, `sign-up/email returned ${response.status}: ${body}`);
});

test('production Better Auth exposes the configured Google initiation route', async () => {
  const response = await fetch('https://solmint.ir/api/auth/sign-in/social', {
    method: 'POST',
    redirect: 'manual',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
  });
  const body = await readResponse(response);
  console.log(`[auth-production-smoke] sign-in/social status=${response.status} location=${response.headers.get('location') || ''} body=${body}`);
  assert.ok(response.status < 500, `sign-in/social returned ${response.status}: ${body}`);
  assert.notEqual(response.status, 404, `Google initiation route is not available: ${body}`);
});
