import assert from 'node:assert/strict';
import { test } from 'node:test';

const baseURL = (process.env.AUTH_SMOKE_BASE_URL || '').trim().replace(/\/$/, '');

if (!baseURL) {
  test('live Better Auth smoke suite requires AUTH_SMOKE_BASE_URL', { skip: 'live smoke is intentionally excluded from the unit CI suite' }, () => {});
} else {
  async function readResponse(response: Response): Promise<string> {
    return (await response.text()).slice(0, 800);
  }

  test('Better Auth session route initializes', async () => {
    const response = await fetch(`${baseURL}/api/auth/get-session`, {
      method: 'GET',
      redirect: 'manual',
      headers: { Accept: 'application/json' },
    });
    const body = await readResponse(response);
    console.log(`[auth-live-smoke] get-session status=${response.status} body=${body}`);
    assert.ok(response.status < 500, `get-session returned ${response.status}: ${body}`);
  });

  test('application session endpoint fails closed without a valid browser session', async () => {
    const response = await fetch(`${baseURL}/api/users/me`, {
      method: 'GET',
      redirect: 'manual',
      headers: { Accept: 'application/json' },
    });
    const body = await readResponse(response);
    console.log(`[auth-live-smoke] users/me status=${response.status} body=${body}`);
    assert.ok([401, 503].includes(response.status), `users/me must not be public: ${response.status}: ${body}`);
  });

  test('Better Auth rejects invalid signup input without a server failure', async () => {
    const response = await fetch(`${baseURL}/api/auth/sign-up/email`, {
      method: 'POST',
      redirect: 'manual',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email', name: 'Smoke Test', password: 'x', username: 'smoke_test_invalid' }),
    });
    const body = await readResponse(response);
    console.log(`[auth-live-smoke] sign-up/email status=${response.status} body=${body}`);
    assert.ok(response.status < 500, `sign-up/email returned ${response.status}: ${body}`);
  });

  test('Better Auth exposes the configured Google initiation route', async () => {
    const response = await fetch(`${baseURL}/api/auth/sign-in/social`, {
      method: 'POST',
      redirect: 'manual',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
    });
    const body = await readResponse(response);
    console.log(`[auth-live-smoke] sign-in/social status=${response.status} location=${response.headers.get('location') || ''} body=${body}`);
    assert.ok(response.status < 500, `sign-in/social returned ${response.status}: ${body}`);
    assert.notEqual(response.status, 404, `Google initiation route is not available: ${body}`);
  });

  test('logout endpoint remains safe and callable without an existing session', async () => {
    const response = await fetch(`${baseURL}/api/auth/logout`, {
      method: 'POST',
      redirect: 'manual',
      headers: { Accept: 'application/json' },
    });
    const body = await readResponse(response);
    console.log(`[auth-live-smoke] logout status=${response.status} body=${body}`);
    assert.equal(response.status, 200, `logout returned ${response.status}: ${body}`);
  });
}
