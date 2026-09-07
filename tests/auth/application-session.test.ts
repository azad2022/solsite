import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapBetterAuthUserToApplicationUser } from '../../functions/api/auth/_application-session';

test('Better Auth application mapping preserves the Better Auth identity id and maps the application user id', () => {
  const result = mapBetterAuthUserToApplicationUser(
    {
      id: 'ba-user-1',
      email: 'u@example.com',
      name: 'U',
      createdAt: '2026-09-07T00:00:00.000Z',
    },
    {
      application_user_id: 'usr-1',
      username: 'user1',
      full_name: 'User One',
      role: 'user',
      permissions: [],
      is_active: true,
      created_at: '2026-09-07T00:00:00.000Z',
    },
  );

  assert.deepEqual(result, {
    id: 'ba-user-1',
    applicationUserId: 'usr-1',
    username: 'user1',
    fullName: 'User One',
    role: 'user',
    permissions: [],
    isActive: true,
    createdAt: '2026-09-07T00:00:00.000Z',
  });
});

test('Better Auth application mapping rejects inactive application users', () => {
  const result = mapBetterAuthUserToApplicationUser(
    {
      id: 'ba-user-2',
      email: 'u2@example.com',
      name: 'U2',
      createdAt: '2026-09-07T00:00:00.000Z',
    },
    {
      application_user_id: 'usr-2',
      username: 'user2',
      full_name: 'User Two',
      role: 'admin',
      permissions: [],
      is_active: false,
      created_at: '2026-09-07T00:00:00.000Z',
    },
  );

  assert.equal(result, null);
});

test('Better Auth application mapping falls back to verified Better Auth identity fields only for missing profile fields', () => {
  const result = mapBetterAuthUserToApplicationUser(
    {
      id: 'ba-user-3',
      email: 'u3@example.com',
      name: 'User Three',
      createdAt: '2026-09-07T00:00:00.000Z',
    },
    {
      application_user_id: 'usr-3',
      username: null,
      full_name: null,
      role: null,
      permissions: { unexpected: true },
      is_active: true,
      created_at: null,
    },
  );

  assert.deepEqual(result, {
    id: 'ba-user-3',
    applicationUserId: 'usr-3',
    username: 'u3@example.com',
    fullName: 'User Three',
    role: 'user',
    permissions: [],
    isActive: true,
    createdAt: '2026-09-07T00:00:00.000Z',
  });
});
