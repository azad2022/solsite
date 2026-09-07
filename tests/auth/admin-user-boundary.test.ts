import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const indexRoute = readFileSync(new URL('../../functions/api/users/index.ts', import.meta.url), 'utf8');
const updateRoute = readFileSync(new URL('../../functions/api/users/update.ts', import.meta.url), 'utf8');
const deleteRoute = readFileSync(new URL('../../functions/api/users/delete.ts', import.meta.url), 'utf8');

test('admin user listing authenticates through the Better Auth application boundary', () => {
  assert.match(indexRoute, /getBetterAuthApplicationUser/);
  assert.doesNotMatch(indexRoute, /getAuthenticatedUser/);
});

test('admin user update authenticates through the Better Auth application boundary', () => {
  assert.match(updateRoute, /getBetterAuthApplicationUser/);
  assert.doesNotMatch(updateRoute, /getAuthenticatedUser/);
  assert.doesNotMatch(updateRoute, /hashPassword\(/);
  assert.match(updateRoute, /BETTER_AUTH_PASSWORD_ADMIN_API_REQUIRED/);
});

test('admin user deletion authenticates through the Better Auth application boundary', () => {
  assert.match(deleteRoute, /getBetterAuthApplicationUser/);
  assert.doesNotMatch(deleteRoute, /getAuthenticatedUser/);
  assert.match(deleteRoute, /SELF_DELETE_FORBIDDEN/);
  assert.match(deleteRoute, /SUPERADMIN_DELETE_FORBIDDEN/);
});
