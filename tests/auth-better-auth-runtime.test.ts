import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBetterAuthDatabase } from '../functions/api/auth/_database';
import { getBetterAuthFoundationConfig } from '../functions/api/auth/_foundation';

const secret = 'x'.repeat(32);

test('production database transport fails closed without Supabase credentials', () => {
  assert.throws(
    () => createBetterAuthDatabase({ NODE_ENV: 'production' }),
    /SUPABASE_URL is required|SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required/
  );
});

test('development transport accepts an explicit PostgreSQL URL', async () => {
  const database = createBetterAuthDatabase({
    NODE_ENV: 'development',
    BETTER_AUTH_DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/solmint',
  });

  assert.equal(database.adapter instanceof Object, true);
  assert.equal(database.application !== undefined, true);
  await database.close();
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
