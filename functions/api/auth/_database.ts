import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { type AdapterFactory } from 'better-auth/adapters';
import { createSupabaseBetterAuthAdapter } from './_supabase-adapter';

export interface BetterAuthDatabaseEnv {
  NODE_ENV?: string;
  BETTER_AUTH_DATABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
}

export interface ApplicationUserRow {
  id: string;
  username: string;
  full_name: string;
  role: string | null;
  permissions: unknown;
  is_active: boolean | null;
  created_at: string | null;
  password_hash?: string | null;
}

export interface ApplicationIdentityLinkRow {
  better_auth_user_id: string;
  application_user_id: string;
}

export interface ApplicationAuthDatabase {
  findApplicationUserByUsername(username: string): Promise<ApplicationUserRow | null>;
  findIdentityByApplicationUserId(applicationUserId: string): Promise<ApplicationIdentityLinkRow | null>;
  findIdentityByBetterAuthUserId(betterAuthUserId: string): Promise<ApplicationUserRow | null>;
  findBetterAuthIdentityByEmail(email: string): Promise<{ id: string } | null>;
  findBetterAuthSessionToken(sessionId: string, userId: string): Promise<string | null>;
  createApplicationUser(input: { id: string; username: string; fullName: string; passwordHash: string; createdAt: string }): Promise<void>;
  linkIdentity(input: { betterAuthUserId: string; applicationUserId: string; source: 'native' | 'legacy-migration' }): Promise<void>;
  deleteApplicationUser(applicationUserId: string): Promise<void>;
  deleteBetterAuthUser(betterAuthUserId: string): Promise<void>;
}

export interface BetterAuthDatabaseHandle {
  adapter: AdapterFactory<any> | Pool;
  application: ApplicationAuthDatabase;
  close(): Promise<void>;
}

let localPool: Pool | null = null;

function isLocalRuntime(env: BetterAuthDatabaseEnv): boolean {
  return env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
}

function getSupabaseCredentials(env: BetterAuthDatabaseEnv): { url: string; key: string } {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) throw new Error('SUPABASE_URL is required for the production auth database transport.');
  if (!key) throw new Error('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required for the production auth database transport.');
  return { url, key };
}

function createSupabaseAdmin(env: BetterAuthDatabaseEnv): SupabaseClient {
  const { url, key } = getSupabaseCredentials(env);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function createPgApplicationDatabase(pool: Pool): ApplicationAuthDatabase {
  return {
    async findApplicationUserByUsername(username) {
      const result = await pool.query<ApplicationUserRow>(
        `select id, username, full_name, role, permissions, is_active, created_at, password_hash
         from public.users where lower(username) = lower($1) limit 1`, [username]);
      return result.rows[0] ?? null;
    },
    async findIdentityByApplicationUserId(applicationUserId) {
      const result = await pool.query<ApplicationIdentityLinkRow>(
        `select better_auth_user_id, application_user_id from public.auth_identity_links where application_user_id = $1 limit 1`, [applicationUserId]);
      return result.rows[0] ?? null;
    },
    async findIdentityByBetterAuthUserId(betterAuthUserId) {
      const result = await pool.query<ApplicationUserRow>(
        `select u.id, u.username, u.full_name, u.role, u.permissions, u.is_active, u.created_at
         from public.auth_identity_links l join public.users u on u.id = l.application_user_id
         where l.better_auth_user_id = $1 limit 1`, [betterAuthUserId]);
      return result.rows[0] ?? null;
    },
    async findBetterAuthIdentityByEmail(email) {
      const result = await pool.query<{ id: string }>(
        `select id from better_auth."user" where lower(email) = lower($1) limit 1`, [email]);
      return result.rows[0] ?? null;
    },
    async findBetterAuthSessionToken(sessionId, userId) {
      const result = await pool.query<{ token: string }>(
        `select token from better_auth.session where id = $1 and user_id = $2 and expires_at > now() limit 1`,
        [sessionId, userId],
      );
      return result.rows[0]?.token ?? null;
    },
    async createApplicationUser(input) {
      await pool.query(
        `insert into public.users (id, username, full_name, password_hash, role, permissions, is_active, created_at)
         values ($1, $2, $3, $4, 'user', '[]'::jsonb, true, $5)`,
        [input.id, input.username, input.fullName, input.passwordHash, input.createdAt]);
    },
    async linkIdentity(input) {
      await pool.query(
        `insert into public.auth_identity_links (better_auth_user_id, application_user_id, source)
         values ($1, $2, $3)
         on conflict (better_auth_user_id) do update set application_user_id = excluded.application_user_id, source = excluded.source, updated_at = now()`,
        [input.betterAuthUserId, input.applicationUserId, input.source]);
    },
    async deleteApplicationUser(applicationUserId) {
      await pool.query('delete from public.users where id = $1', [applicationUserId]);
    },
    async deleteBetterAuthUser(betterAuthUserId) {
      await pool.query('delete from better_auth."user" where id = $1', [betterAuthUserId]);
    },
  };
}

function createSupabaseApplicationDatabase(client: SupabaseClient): ApplicationAuthDatabase {
  const callAdapter = async (operation: string, input: Record<string, unknown> = {}) => {
    const { data, error } = await client.rpc('solmint_better_auth_adapter', {
      p_operation: operation,
      p_model: input.model ?? null,
      p_data: input.data ?? {},
      p_where: input.where ?? [],
      p_limit: input.limit ?? null,
      p_offset: input.offset ?? 0,
      p_sort: input.sort ?? null,
      p_increment: input.increment ?? {},
      p_set: input.set ?? {},
    });
    if (error) throw error;
    return data;
  };

  return {
    async findApplicationUserByUsername(username) {
      const normalized = username.trim().toLowerCase();
      const { data, error } = await client.from('users')
        .select('id,username,full_name,role,permissions,is_active,created_at,password_hash')
        .eq('username', normalized).limit(1).maybeSingle();
      if (error) throw error;
      return data as ApplicationUserRow | null;
    },
    async findIdentityByApplicationUserId(applicationUserId) {
      const { data, error } = await client.from('auth_identity_links')
        .select('better_auth_user_id,application_user_id').eq('application_user_id', applicationUserId).limit(1).maybeSingle();
      if (error) throw error;
      return data as ApplicationIdentityLinkRow | null;
    },
    async findIdentityByBetterAuthUserId(betterAuthUserId) {
      const { data, error } = await client.from('auth_identity_links')
        .select('application_user_id, users!inner(id,username,full_name,role,permissions,is_active,created_at)')
        .eq('better_auth_user_id', betterAuthUserId).limit(1).maybeSingle();
      if (error) throw error;
      const row = data as unknown as { application_user_id?: string; users?: ApplicationUserRow | ApplicationUserRow[] | null } | null;
      const related = Array.isArray(row?.users) ? row?.users[0] : row?.users;
      return row?.application_user_id && related ? ({ ...related } as ApplicationUserRow) : null;
    },
    async findBetterAuthIdentityByEmail(email) {
      const record = await callAdapter('find_one', {
        model: 'user',
        data: {},
        where: [{ field: 'email', value: email, operator: 'eq' }],
        limit: 1,
        offset: 0,
      }) as { id?: string } | null;
      return record?.id ? { id: record.id } : null;
    },
    async findBetterAuthSessionToken(sessionId, userId) {
      const record = await callAdapter('find_one', {
        model: 'session',
        data: {},
        where: [
          { field: 'id', value: sessionId, operator: 'eq' },
          { field: 'user_id', value: userId, operator: 'eq' },
          { field: 'expires_at', value: new Date().toISOString(), operator: 'gt' },
        ],
        limit: 1,
        offset: 0,
      }) as { token?: string } | null;
      return record?.token ? String(record.token) : null;
    },
    async createApplicationUser(input) {
      const { error } = await client.from('users').insert({
        id: input.id,
        username: input.username,
        full_name: input.fullName,
        password_hash: input.passwordHash,
        role: 'user',
        permissions: [],
        is_active: true,
        created_at: input.createdAt,
      });
      if (error) throw error;
    },
    async linkIdentity(input) {
      const { error } = await client.from('auth_identity_links').upsert(
        { better_auth_user_id: input.betterAuthUserId, application_user_id: input.applicationUserId, source: input.source },
        { onConflict: 'better_auth_user_id' },
      );
      if (error) throw error;
    },
    async deleteApplicationUser(applicationUserId) {
      const { error } = await client.from('users').delete().eq('id', applicationUserId);
      if (error) throw error;
    },
    async deleteBetterAuthUser(betterAuthUserId) {
      await callAdapter('delete', {
        model: 'user',
        where: [{ field: 'id', value: betterAuthUserId, operator: 'eq' }],
      });
    },
  };
}

export function createBetterAuthDatabase(env: BetterAuthDatabaseEnv): BetterAuthDatabaseHandle {
  if (isLocalRuntime(env) && env.BETTER_AUTH_DATABASE_URL?.trim()) {
    localPool ??= new Pool({
      connectionString: env.BETTER_AUTH_DATABASE_URL.trim(),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      options: '-c search_path=better_auth,public',
    });
    return { adapter: localPool, application: createPgApplicationDatabase(localPool), close: async () => {} };
  }

  const client = createSupabaseAdmin(env);
  return { adapter: createSupabaseBetterAuthAdapter({ client }), application: createSupabaseApplicationDatabase(client), close: async () => {} };
}
