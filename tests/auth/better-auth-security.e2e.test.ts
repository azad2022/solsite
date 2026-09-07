import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBetterAuthRuntime } from '../../functions/api/auth/_instance';

const databaseUrl = process.env.BETTER_AUTH_DATABASE_URL;
const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:8787';
const secret = process.env.BETTER_AUTH_SECRET ?? 'test-secret-'.padEnd(32, 'x');

const runtime = databaseUrl
  ? createBetterAuthRuntime({
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_DATABASE_URL: databaseUrl,
    })
  : null;

const db = runtime?.database;

test.after(async () => {
  if (db) await db.end();
});

test(
  'Better Auth rejects cross-origin authentication requests and does not create a session',
  { skip: !runtime },
  async () => {
    if (!runtime) return;

    const response = await runtime.auth.handler(
      new Request(`${baseURL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://evil.example',
          'cf-connecting-ip': '198.51.100.31',
        },
        body: JSON.stringify({
          email: 'nobody@example.test',
          password: 'not-a-real-password',
        }),
      }),
    );

    assert.equal(response.status, 403);
    assert.equal(response.headers.get('set-cookie'), null);
  },
);

test(
  'Better Auth does not reveal whether a verified email exists',
  { skip: !runtime },
  async () => {
    if (!runtime || !db) return;

    const suffix = Date.now();
    const email = `security-enumeration-${suffix}@example.test`;
    const password = 'A-strong-test-password-123!';
    const username = `security_enum_${suffix}`;

    try {
      const signUp = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: baseURL,
            'cf-connecting-ip': '198.51.100.32',
          },
          body: JSON.stringify({ email, password, name: 'Security User', username }),
        }),
      );
      assert.equal(signUp.status, 200);

      await db.query('update better_auth."user" set email_verified = true where email = $1', [email]);

      const knownWrongPassword = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: baseURL,
            'cf-connecting-ip': '198.51.100.33',
          },
          body: JSON.stringify({ email, password: 'definitely-wrong-password' }),
        }),
      );

      const unknownUser = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: baseURL,
            'cf-connecting-ip': '198.51.100.34',
          },
          body: JSON.stringify({ email: `unknown-${suffix}@example.test`, password }),
        }),
      );

      assert.equal(knownWrongPassword.status, unknownUser.status);
      assert.equal((await knownWrongPassword.json()).code, (await unknownUser.json()).code);
      assert.equal(knownWrongPassword.headers.get('set-cookie'), null);
      assert.equal(unknownUser.headers.get('set-cookie'), null);
    } finally {
      await db.query('delete from better_auth."user" where email = $1', [email]).catch(() => {});
    }
  },
);

test(
  'Better Auth enforces the stricter email sign-in rate limit and exposes retry metadata',
  { skip: !runtime },
  async () => {
    if (!runtime || !db) return;

    const email = `rate-limit-${Date.now()}@example.test`;

    const request = () =>
      runtime.auth.handler(
        new Request(`${baseURL}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: baseURL,
            'cf-connecting-ip': '198.51.100.35',
          },
          body: JSON.stringify({ email, password: 'invalid' }),
        }),
      );

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await request();
        assert.notEqual(response.status, 429, `attempt ${attempt + 1} should still be inside the configured limit`);
      }

      const limited = await request();
      assert.equal(limited.status, 429);
      assert.match(limited.headers.get('x-retry-after') ?? '', /^\d+$/);
    } finally {
      await db.query(
        'delete from better_auth.rate_limit where key like $1',
        ['198.51.100.35:%'],
      ).catch(() => {});
    }
  },
);

test(
  'Better Auth issues independent concurrent sessions and revokes only the signed-out session',
  { skip: !runtime },
  async () => {
    if (!runtime || !db) return;

    const suffix = Date.now();
    const email = `security-session-${suffix}@example.test`;
    const password = 'A-strong-test-password-123!';
    const username = `security_session_${suffix}`;

    try {
      const signUp = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: baseURL,
            'cf-connecting-ip': '198.51.100.36',
          },
          body: JSON.stringify({ email, password, name: 'Session User', username }),
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

      const first = await signIn('198.51.100.37');
      const second = await signIn('198.51.100.38');
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);

      const firstSetCookie = first.headers.get('set-cookie');
      const secondSetCookie = second.headers.get('set-cookie');
      assert.ok(firstSetCookie);
      assert.ok(secondSetCookie);

      const firstCookie = firstSetCookie!.split(';', 1)[0]!;
      const secondCookie = secondSetCookie!.split(';', 1)[0]!;
      assert.notEqual(firstCookie, secondCookie, 'each authentication must create a distinct session token');

      const sessions = await db.query<{ count: string }>(
        'select count(*)::text as count from better_auth.session where user_id = (select id from better_auth."user" where email = $1)',
        [email],
      );
      assert.equal(Number(sessions.rows[0]?.count), 2);

      const signOut = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/sign-out`, {
          method: 'POST',
          headers: {
            cookie: firstCookie,
            origin: baseURL,
            'cf-connecting-ip': '198.51.100.37',
          },
        }),
      );
      assert.equal(signOut.status, 200);

      const revokedSession = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/get-session`, {
          headers: { cookie: firstCookie, origin: baseURL },
        }),
      );
      assert.equal(await revokedSession.json(), null);

      const remainingSession = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/get-session`, {
          headers: { cookie: secondCookie, origin: baseURL },
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
  'Better Auth keeps usernames immutable and rejects duplicate usernames before provisioning',
  { skip: !runtime },
  async () => {
    if (!runtime || !db) return;

    const suffix = Date.now();
    const username = `immutable_${suffix}`;
    const firstEmail = `immutable-a-${suffix}@example.test`;
    const secondEmail = `immutable-b-${suffix}@example.test`;
    const password = 'A-strong-test-password-123!';

    try {
      const signUp = async (email: string) =>
        runtime.auth.handler(
          new Request(`${baseURL}/api/auth/sign-up/email`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              origin: baseURL,
              'cf-connecting-ip': email === firstEmail ? '198.51.100.39' : '198.51.100.40',
            },
            body: JSON.stringify({ email, password, name: 'Username User', username }),
          }),
        );

      const first = await signUp(firstEmail);
      assert.equal(first.status, 200);
      const duplicate = await signUp(secondEmail);
      assert.equal(duplicate.status, 409);

      await db.query('update better_auth."user" set email_verified = true where email = $1', [firstEmail]);
      const signIn = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: baseURL,
            'cf-connecting-ip': '198.51.100.41',
          },
          body: JSON.stringify({ email: firstEmail, password }),
        }),
      );
      assert.equal(signIn.status, 200);
      const cookie = signIn.headers.get('set-cookie')!.split(';', 1)[0]!;

      const updateUsername = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/update-user`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie,
            origin: baseURL,
            'cf-connecting-ip': '198.51.100.41',
          },
          body: JSON.stringify({ username: `${username}_changed` }),
        }),
      );
      assert.equal(updateUsername.status, 400);

      const stored = await db.query<{ username: string }>(
        'select username from better_auth."user" where email = $1',
        [firstEmail],
      );
      assert.equal(stored.rows[0]?.username, username);
    } finally {
      await db.query(
        'delete from better_auth."user" where email in ($1, $2)',
        [firstEmail, secondEmail],
      ).catch(() => {});
    }
  },
);

test(
  'Better Auth rejects a forged OAuth callback state before establishing authentication',
  { skip: !runtime },
  async () => {
    if (!databaseUrl) return;

    const oauthRuntime = createBetterAuthRuntime({
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_DATABASE_URL: databaseUrl,
      GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    });

    try {
      const start = await oauthRuntime.auth.handler(
        new Request(`${baseURL}/api/auth/sign-in/social`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: baseURL,
            'cf-connecting-ip': '198.51.100.42',
          },
          body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
        }),
      );

      assert.equal(start.status, 200);
      const startBody = (await start.json()) as { url?: string };
      assert.ok(startBody.url);

      const callback = await oauthRuntime.auth.handler(
        new Request(`${baseURL}/api/auth/callback/google?code=fake-code&state=forged-state`, {
          method: 'GET',
          headers: {
            origin: baseURL,
            'cf-connecting-ip': '198.51.100.42',
          },
        }),
      );

      assert.notEqual(callback.status, 200);
      assert.equal(callback.headers.get('set-cookie')?.includes('__Host-solmint_auth_session'), false);
    } finally {
      if (oauthRuntime.database !== db) await oauthRuntime.database.end();
    }
  },
);
