import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBetterAuthDatabase } from '../functions/api/auth/_database';
import { getBetterAuthFoundationConfig } from '../functions/api/auth/_foundation';

const secret = 'x'.repeat(32);

 test('production database transport fails closed without Hyperdrive', () => {
  assert.throws(
    () => createBetterAuthDatabase({ NODE_ENV: 'production' }),
    /HYPERDRIVE binding/
  );
});

test('development transport accepts an explicit PostgreSQL URL', async () => {
  const pool = createBetterAuthDatabase({
    NODE_ENV: 'development',
    BETTER_AUTH_DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/solmint',
  });

  assert.equal(pool.options.connectionString, 'postgres://user:pass@127.0.0.1:5432/solmint');
  await pool.end();
});

test('production auth foundation requires an explicit HTTPS origin', () => {
  assert.throws(
    () => getBetterAuthFoundationConfig({
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: 'http://solmint.ir',
    }),
    /must use HTTPS/
  );
});
