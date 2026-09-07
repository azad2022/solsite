import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Pool } from 'pg';
import { createBetterAuthRuntime } from '../../functions/api/auth/_instance';
import { onRequest as betterAuthPagesHandler } from '../../functions/api/auth/[[path]]';

const databaseUrl = process.env.BETTER_AUTH_DATABASE_URL;
const secret = process.env.BETTER_AUTH_SECRET ?? 'test-secret-'.padEnd(32, 'x');
const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:8787';

test(
  'Better Auth PostgreSQL runtime provisions the application identity and serves a secure session lifecycle',
  { skip: !databaseUrl },
  async () => {
    if (!databaseUrl) return;

    const pool = new Pool({ connectionString: databaseUrl });
    const runtime = createBetterAuthRuntime({
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_DATABASE_URL: databaseUrl,
    });

    const email = `integration-${Date.now()}@example.test`;
    const password = 'A-strong-test-password-123!';
    const username = `integration_${Date.now()}`;
    const requestHeaders = {
      'content-type': 'application/json',
      origin: baseURL,
      'cf-connecting-ip': '198.51.100.17',
    };

    try {
      const signUpResponse = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify({ email, password, name: 'Integration User', username }),
        }),
      );
      const signUpBody = await signUpResponse.text();

      assert.equal(signUpResponse.status, 200, `sign-up failed: ${signUpBody}`);

      const userResult = await pool.query<{
        id: string;
        email_verified: boolean;
        username: string | null;
      }>(
        'select id, email_verified, username from better_auth."user" where email = $1',
        [email],
      );
      assert.equal(userResult.rows.length, 1);
      assert.equal(userResult.rows[0]?.email_verified, false);
      assert.equal(userResult.rows[0]?.username, username);

      const accountResult = await pool.query<{ provider_id: string; account_id: string; password: string | null }>(
        'select provider_id, account_id, password from better_auth.account where user_id = $1',
        [userResult.rows[0]!.id],
      );
      assert.equal(accountResult.rows.length, 1);
      assert.equal(accountResult.rows[0]?.provider_id, 'credential');
      assert.equal(accountResult.rows[0]?.account_id, userResult.rows[0]!.id);
      assert.ok(accountResult.rows[0]?.password);

      const profileResult = await pool.query<{
        id: string;
        username: string;
        role: string;
        is_active: boolean;
      }>(
        'select u.id, u.username, u.role, u.is_active from public.users u join public.auth_identity_links l on l.application_user_id = u.id where l.better_auth_user_id = $1',
        [userResult.rows[0]!.id],
      );
      assert.equal(profileResult.rows.length, 1);
      assert.equal(profileResult.rows[0]?.username, username);
      assert.equal(profileResult.rows[0]?.role, 'user');
      assert.equal(profileResult.rows[0]?.is_active, true);

      const identityLinkResult = await pool.query<{ source: string }>(
        'select source from public.auth_identity_links where better_auth_user_id = $1',
        [userResult.rows[0]!.id],
      );
      assert.equal(identityLinkResult.rows[0]?.source, 'native');

      await pool.query('update better_auth."user" set email_verified = true where id = $1', [userResult.rows[0]!.id]);

      const signInResponse = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify({ email, password }),
        }),
      );

      assert.equal(signInResponse.status, 200);
      const setCookie = signInResponse.headers.get('set-cookie');
      assert.ok(setCookie, 'sign-in must issue a server-side session cookie');
      assert.match(setCookie!, /HttpOnly/i);
      assert.match(setCookie!, /Path=\//i);
      assert.match(setCookie!, /SameSite=Strict/i);

      const cookie = setCookie!.split(';', 1)[0]!;

      const sessionResponse = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/get-session`, {
          method: 'GET',
          headers: {
            cookie,
            origin: baseURL,
            'cf-connecting-ip': '198.51.100.17',
          },
        }),
      );
      assert.equal(sessionResponse.status, 200);
      const sessionBody = (await sessionResponse.json()) as { user?: { email?: string } };
      assert.equal(sessionBody.user?.email, email);

      const sessionCount = await pool.query<{ count: string }>(
        'select count(*)::text as count from better_auth.session where user_id = $1',
        [userResult.rows[0]!.id],
      );
      assert.equal(Number(sessionCount.rows[0]?.count), 1);

      const signOutResponse = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/sign-out`, {
          method: 'POST',
          headers: {
            cookie,
            origin: baseURL,
            'cf-connecting-ip': '198.51.100.17',
          },
        }),
      );
      assert.equal(signOutResponse.status, 200);

      const revokedSessionCount = await pool.query<{ count: string }>(
        'select count(*)::text as count from better_auth.session where user_id = $1',
        [userResult.rows[0]!.id],
      );
      assert.equal(Number(revokedSessionCount.rows[0]?.count), 0);
    } finally {
      await pool.query('delete from better_auth."user" where email = $1', [email]).catch(() => {});
      await pool.end();
      await runtime.database.end();
    }
  },
);

test(
  'Pages Functions auth handler uses the production Hyperdrive transport boundary',
  { skip: !databaseUrl },
  async () => {
    if (!databaseUrl) return;

    const productionURL = 'https://auth.example.test';
    const response = await betterAuthPagesHandler({
      request: new Request(`${productionURL}/api/auth/get-session`, {
        method: 'GET',
        headers: {
          origin: productionURL,
          'cf-connecting-ip': '198.51.100.23',
        },
      }),
      env: {
        NODE_ENV: 'production',
        BETTER_AUTH_SECRET: secret,
        BETTER_AUTH_URL: productionURL,
        HYPERDRIVE: { connectionString: databaseUrl },
      },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type')?.includes('application/json'), true);
    assert.equal(await response.json(), null);
  },
);
