interface DatabaseClient {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

const UNUSABLE_LEGACY_PASSWORD_PREFIX = 'better-auth-only$';

interface BetterAuthUserRecord {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  createdAt: Date | string;
}

interface ApplicationUserRecord {
  id: string;
  username: string;
  full_name: string;
  role: string | null;
  permissions: unknown;
  is_active: boolean | null;
  created_at: string | null;
}

function normalizeApplicationUsername(user: BetterAuthUserRecord): string {
  const supplied = typeof user.username === 'string' ? user.username.trim().toLowerCase() : '';
  if (supplied) return supplied;

  // OAuth providers do not necessarily supply the Solmint username field.
  // A stable auth-ID-derived fallback avoids inventing an identity from email text.
  return `user_${user.id.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24)}`.slice(0, 30);
}

function unusableLegacyPasswordMarker(): string {
  return `${UNUSABLE_LEGACY_PASSWORD_PREFIX}${crypto.randomUUID()}`;
}

export async function provisionApplicationProfile(
  database: DatabaseClient,
  user: BetterAuthUserRecord,
): Promise<{ applicationUserId: string; source: 'native' | 'legacy-migration' }> {
  const username = normalizeApplicationUsername(user);

  const existing = await database.query<ApplicationUserRecord>(
    `select id, username, full_name, role, permissions, is_active, created_at
     from public.users
     where lower(username) = lower($1)
     limit 1`,
    [username],
  );

  if (existing.rows.length > 0) {
    const applicationUser = existing.rows[0];

    const existingLink = await database.query<{ better_auth_user_id: string }>(
      `select better_auth_user_id
       from public.auth_identity_links
       where application_user_id = $1
       limit 1`,
      [applicationUser.id],
    );

    if (existingLink.rows.length > 0 && existingLink.rows[0].better_auth_user_id !== user.id) {
      throw new Error('Application identity is already linked to another Better Auth identity.');
    }

    await database.query(
      `insert into public.auth_identity_links
        (better_auth_user_id, application_user_id, source)
       values ($1, $2, 'legacy-migration')
       on conflict (better_auth_user_id) do update
       set application_user_id = excluded.application_user_id,
           source = excluded.source,
           updated_at = now()`,
      [user.id, applicationUser.id],
    );

    return { applicationUserId: applicationUser.id, source: 'legacy-migration' };
  }

  const applicationUserId = `usr-${crypto.randomUUID()}`;
  const createdAt = user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt).toISOString();

  try {
    await database.query(
      `insert into public.users
        (id, username, full_name, password_hash, role, permissions, is_active, created_at)
       values ($1, $2, $3, $4, 'user', '[]'::jsonb, true, $5)`,
      [applicationUserId, username, user.name.trim() || user.email, unusableLegacyPasswordMarker(), createdAt],
    );

    await database.query(
      `insert into public.auth_identity_links
        (better_auth_user_id, application_user_id, source)
       values ($1, $2, 'native')`,
      [user.id, applicationUserId],
    );
  } catch (error) {
    await database.query('delete from public.users where id = $1', [applicationUserId]).catch(() => {});
    throw error;
  }

  return { applicationUserId, source: 'native' };
}
