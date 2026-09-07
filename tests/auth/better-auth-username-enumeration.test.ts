import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBetterAuthRuntime } from '../../functions/api/auth/_instance';

const databaseUrl = process.env.BETTER_AUTH_DATABASE_URL;
const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:8787';
const secret = process.env.BETTER_AUTH_SECRET ?? 'test-secret-'.padEnd(32, 'x');

test(
  'username availability endpoint is disabled to prevent account enumeration',
  { skip: !databaseUrl },
  async () => {
    if (!databaseUrl) return;

    const runtime = createBetterAuthRuntime({
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_DATABASE_URL: databaseUrl,
    });

    try {
      const response = await runtime.auth.handler(
        new Request(`${baseURL}/api/auth/is-username-available?username=example`, {
          method: 'GET',
          headers: { origin: baseURL },
        }),
      );

      assert.equal(response.status, 404);
    } finally {
      await runtime.database.end();
    }
  },
);
