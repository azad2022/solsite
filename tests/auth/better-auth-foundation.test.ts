import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBetterAuthFoundationConfig } from '../../functions/api/auth/_foundation.ts';

const validSecret = 'x'.repeat(32);

test('requires a dedicated Better Auth secret', () => {
  assert.throws(
    () => getBetterAuthFoundationConfig({ NODE_ENV: 'production', BETTER_AUTH_URL: 'https://solmint.ir' }),
    /BETTER_AUTH_SECRET is required/
  );
});

test('rejects a weak Better Auth secret', () => {
  assert.throws(
    () => getBetterAuthFoundationConfig({ NODE_ENV: 'production', BETTER_AUTH_SECRET: 'too-short', BETTER_AUTH_URL: 'https://solmint.ir' }),
    /at least 32 characters/
  );
});

test('requires an explicit absolute auth URL', () => {
  assert.throws(
    () => getBetterAuthFoundationConfig({ NODE_ENV: 'production', BETTER_AUTH_SECRET: validSecret }),
    /BETTER_AUTH_URL is required/
  );
  assert.throws(
    () => getBetterAuthFoundationConfig({ NODE_ENV: 'production', BETTER_AUTH_SECRET: validSecret, BETTER_AUTH_URL: '/api/auth' }),
    /valid absolute URL/
  );
});

test('rejects HTTP and localhost in production', () => {
  assert.throws(
    () => getBetterAuthFoundationConfig({ NODE_ENV: 'production', BETTER_AUTH_SECRET: validSecret, BETTER_AUTH_URL: 'http://solmint.ir' }),
    /must use HTTPS/
  );
  assert.throws(
    () => getBetterAuthFoundationConfig({ NODE_ENV: 'production', BETTER_AUTH_SECRET: validSecret, BETTER_AUTH_URL: 'https://localhost:3000' }),
    /must not point to localhost/
  );
});

test('normalizes and deduplicates trusted origins', () => {
  const config = getBetterAuthFoundationConfig({
    NODE_ENV: 'production',
    BETTER_AUTH_SECRET: validSecret,
    BETTER_AUTH_URL: 'https://solmint.ir/',
    BETTER_AUTH_TRUSTED_ORIGINS: 'https://solmint.ir, https://app.solmint.ir, https://app.solmint.ir'
  });

  assert.deepEqual(config.trustedOrigins, ['https://solmint.ir', 'https://app.solmint.ir']);
  assert.equal(config.baseURL, 'https://solmint.ir');
  assert.equal(config.secret, validSecret);
});

test('allows localhost only in development/test', () => {
  const config = getBetterAuthFoundationConfig({
    NODE_ENV: 'development',
    BETTER_AUTH_SECRET: validSecret,
    BETTER_AUTH_URL: 'http://localhost:3000',
    BETTER_AUTH_TRUSTED_ORIGINS: 'http://127.0.0.1:3000'
  });

  assert.deepEqual(config.trustedOrigins, ['http://localhost:3000', 'http://127.0.0.1:3000']);
});
