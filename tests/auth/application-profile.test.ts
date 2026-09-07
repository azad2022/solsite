import assert from 'node:assert/strict';
import { test } from 'node:test';
import { provisionApplicationProfile } from '../../functions/api/auth/_application-profile';
import type { ApplicationAuthDatabase } from '../../functions/api/auth/_database';

class FakeDatabase {
  public users = new Map<string, { id: string; username: string; full_name: string; role: string; permissions: unknown; is_active: boolean; created_at: string }>();
  public links = new Map<string, { better_auth_user_id: string; application_user_id: string; source: string }>();

  async query<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<{ rows: T[] }> {
    const sql = text.replace(/\s+/g, ' ').trim().toLowerCase();

    if (sql.startsWith('select id, username') && sql.includes('from public.users')) {
      const username = String(values[0]).toLowerCase();
      const rows = [...this.users.values()].filter((u) => u.username.toLowerCase() === username);
      return { rows: rows as unknown as T[] };
    }

    if (sql.startsWith('select better_auth_user_id') && sql.includes('from public.auth_identity_links')) {
      const applicationUserId = String(values[0]);
      const rows = [...this.links.values()].filter((l) => l.application_user_id === applicationUserId);
      return { rows: rows.map((r) => ({ better_auth_user_id: r.better_auth_user_id })) as unknown as T[] };
    }

    if (sql.startsWith('insert into public.users')) {
      const [id, username, fullName, passwordHash, createdAt] = values.map(String);
      if ([...this.users.values()].some((u) => u.username.toLowerCase() === username.toLowerCase())) {
        throw new Error('duplicate username');
      }
      this.users.set(id, {
        id,
        username,
        full_name: fullName,
        role: 'user',
        permissions: [],
        is_active: true,
        created_at: createdAt,
      });
      assert.match(passwordHash, /^better-auth-only\$/);
      return { rows: [] as T[] };
    }

    if (sql.startsWith('insert into public.auth_identity_links')) {
      const [betterAuthUserId, applicationUserId] = values.map(String);
      const source = sql.includes("'native'") ? 'native' : 'legacy-migration';
      const duplicateTarget = [...this.links.values()].find((l) => l.application_user_id === applicationUserId && l.better_auth_user_id !== betterAuthUserId);
      if (duplicateTarget) throw new Error('duplicate application identity link');
      this.links.set(betterAuthUserId, { better_auth_user_id: betterAuthUserId, application_user_id: applicationUserId, source });
      return { rows: [] as T[] };
    }

    if (sql.startsWith('delete from public.users')) {
      this.users.delete(String(values[0]));
      return { rows: [] as T[] };
    }

    throw new Error(`Unhandled SQL in fake database: ${text}`);
  }
}

const asApplicationDatabase = (database: FakeDatabase) => database as unknown as ApplicationAuthDatabase;

const baseUser = {
  email: 'new@example.com',
  name: 'New User',
  createdAt: new Date('2026-09-07T00:00:00.000Z'),
};

test('native Better Auth user provisions a user and native bridge', async () => {
  const database = new FakeDatabase();
  const result = await provisionApplicationProfile(asApplicationDatabase(database), {
    id: 'ba-native-1',
    username: 'new_user',
    ...baseUser,
  });

  assert.equal(result.applicationUserId.startsWith('usr-'), true);
  assert.equal(database.users.size, 1);
  assert.equal(database.links.size, 1);
  assert.equal(database.links.get('ba-native-1')?.application_user_id, result.applicationUserId);
  assert.equal(database.links.get('ba-native-1')?.source, 'native');
});

test('existing application user is reused for legacy migration', async () => {
  const database = new FakeDatabase();
  database.users.set('usr-legacy-1', {
    id: 'usr-legacy-1',
    username: 'legacy_user',
    full_name: 'Legacy User',
    role: 'admin',
    permissions: ['content'],
    is_active: true,
    created_at: '2026-08-01T00:00:00.000Z',
  });

  const result = await provisionApplicationProfile(asApplicationDatabase(database), {
    id: 'ba-legacy-1',
    username: 'legacy_user',
    email: 'legacy@example.com',
    name: 'Legacy User',
    createdAt: new Date('2026-09-07T00:00:00.000Z'),
  });

  assert.equal(result.applicationUserId, 'usr-legacy-1');
  assert.equal(database.users.size, 1);
  assert.equal(database.links.get('ba-legacy-1')?.application_user_id, 'usr-legacy-1');
  assert.equal(database.links.get('ba-legacy-1')?.source, 'legacy-migration');
});

test('an application identity already linked to another Better Auth user is rejected', async () => {
  const database = new FakeDatabase();
  database.users.set('usr-conflict-1', {
    id: 'usr-conflict-1',
    username: 'conflict_user',
    full_name: 'Conflict User',
    role: 'user',
    permissions: [],
    is_active: true,
    created_at: '2026-08-01T00:00:00.000Z',
  });
  database.links.set('ba-existing', {
    better_auth_user_id: 'ba-existing',
    application_user_id: 'usr-conflict-1',
    source: 'legacy-migration',
  });

  await assert.rejects(
    () => provisionApplicationProfile(asApplicationDatabase(database), {
      id: 'ba-attacker',
      username: 'conflict_user',
      email: 'attacker@example.com',
      name: 'Attacker',
      createdAt: new Date('2026-09-07T00:00:00.000Z'),
    }),
    /already linked to another Better Auth identity/,
  );
});