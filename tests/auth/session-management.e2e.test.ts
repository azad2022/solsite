import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Pool } from 'pg';
import { onRequestGet, onRequestPost } from '../../functions/api/users/sessions';
import { createBetterAuthRuntime } from '../../functions/api/auth/_instance';

type TestEnv = Parameters<typeof createBetterAuthRuntime>[0] & { NODE_ENV: 'test' };

const databaseUrl = process.env.BETTER_AUTH_DATABASE_URL;
const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:8787';
const secret = process.env.BETTER_AUTH_SECRET ?? 'test-secret-'.padEnd(32, 'x');

const env: TestEnv | null = databaseUrl
  ? {
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_DATABASE_URL: databaseUrl,
    }
  : null;

const runtime = env ? createBetterAuthRuntime(env) : null;
const db = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie);
  return setCookie.split(';', 1)[0]!;
}

test.after(async () => {
  if (runtime) await runtime.close();
  if (db) await db.end();
});

test(
  'session management lists safe metadata only and revokes one non-current session',
  { skip: !runtime || !env || !db },
  async () => {
    assert.ok(runtime && env && db);

    const suffix = Date.now();
    const email = `session-management-${suffix}@example.test`;
    const password = 'A-strong-test-password-123!';
    const username = `session_mgmt_${suffix}`;

    try {
      const signUp = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: baseURL,
            'cf-connecting-ip': '198.51.100.50',
          },
          body: JSON.stringify({ email, password, name: 'Session Management User', username }),
        }),
      );
      assert.equal(signUp.status, 200);
      await db.query('update better_auth."user" set email_verified = true where email = $1', [email]);

      const signIn = async (ip: string) =>
        runtime.auth.handler(
          new Request(`${baseURL}/api/auth/sign-in/email`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              origin: baseURL,
              'cf-connecting-ip': ip,
            },
            body: JSON.stringify({ email, password }),
          }),
        );

      const firstSignIn = await signIn('198.51.100.51');
      const secondSignIn = await signIn('198.51.100.52');
      assert.equal(firstSignIn.status, 200);
      assert.equal(secondSignIn.status, 200);

      const firstCookie = cookieFrom(firstSignIn);
      const secondCookie = cookieFrom(secondSignIn);

      const listResponse = await onRequestGet({
        request: new Request(`${baseURL}/api/users/sessions`, {
          headers: { cookie: secondCookie },
        }),
        env,
      });
      assert.equal(listResponse.status, 200);
      const listed = (await listResponse.json()) as {
        success: boolean;
        sessions: Array<Record<string, unknown>>;
      };
      assert.equal(listed.success, true);
      assert.equal(listed.sessions.length, 2);
      assert.equal(listed.sessions.filter((item) => item.current).length, 1);
      assert.ok(listed.sessions.every((item) => !('token' in item) && !('sessionToken' in item)));

      const firstSession = listed.sessions.find((item) => item.current === false);
      assert.ok(firstSession?.id);

      const revokeResponse = await onRequestPost({
        request: new Request(`${baseURL}/api/users/sessions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: baseURL,
            cookie: secondCookie,
          },
          body: JSON.stringify({ sessionId: firstSession.id }),
        }),
        env,
      });
      assert.equal(revokeResponse.status, 200);

      const revokedSession = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/get-session`, {
          headers: { cookie: firstCookie },
        }),
      );
      assert.equal(await revokedSession.json(), null);

      const remainingSession = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/get-session`, {
          headers: { cookie: secondCookie },
        }),
      );
      assert.equal(remainingSession.status, 200);
      assert.equal((await remainingSession.json()).user.email, email);
    } finally {
      await db.query('delete from better_auth."user" where email = $1', [email]).catch(() => {});
    }
  },
);

test(
  'session management rejects state-changing requests without a trusted origin',
  { skip: !runtime || !env },
  async () => {
    assert.ok(env);

    const response = await onRequestPost({
      request: new Request(`${baseURL}/api/users/sessions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://evil.example',
          cookie: 'solmint_auth_session=not-real',
        },
        body: JSON.stringify({ sessionId: 'unknown' }),
      }),
      env,
    });

    assert.equal(response.status, 403);
    const body = (await response.json()) as { code?: string };
    assert.equal(body.code, 'CSRF_ORIGIN_REJECTED');
  },
);
