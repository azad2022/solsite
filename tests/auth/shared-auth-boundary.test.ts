import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BetterAuthApplicationResolverUser } from '../../functions/api/auth/_shared';
import { getAuthenticatedUser } from '../../functions/api/auth/_shared';

const resolvedUser: BetterAuthApplicationResolverUser = {
  id: 'ba-user-1',
  applicationUserId: 'usr-123',
  username: 'alice',
  fullName: 'Alice',
  role: 'admin',
  permissions: ['articles'],
  isActive: true,
  createdAt: '2026-09-07T00:00:00.000Z',
};

test('shared authentication boundary maps Better Auth identity to the application user id', async () => {
  let calls = 0;
  const resolver = async () => {
    calls += 1;
    return resolvedUser;
  };

  const request = new Request('https://solmint.ir/api/test', {
    headers: { Cookie: '__Host-solmint_auth_session=opaque-session' },
  });

  const user = await getAuthenticatedUser({ NODE_ENV: 'test' }, request, resolver);

  assert.deepEqual(user, {
    id: 'usr-123',
    username: 'alice',
    full_name: 'Alice',
    role: 'admin',
    permissions: ['articles'],
    is_active: true,
    created_at: '2026-09-07T00:00:00.000Z',
  });
  assert.equal(calls, 1);
});

test('shared authentication boundary fails closed when a Better Auth cookie is invalid', async () => {
  let legacyFallbackCalled = false;
  const resolver = async () => null;

  const request = new Request('https://solmint.ir/api/test', {
    headers: { Cookie: '__Host-solmint_auth_session=invalid' },
  });

  const user = await getAuthenticatedUser(
    { NODE_ENV: 'test' },
    request,
    resolver,
  );

  assert.equal(user, null);
  assert.equal(legacyFallbackCalled, false);
});
