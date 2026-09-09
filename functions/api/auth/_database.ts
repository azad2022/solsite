import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type AdapterFactory } from 'better-auth/adapters';
import { createSupabaseBetterAuthAdapter } from './_supabase-adapter';

export interface BetterAuthDatabaseEnv {
  NODE_ENV?: string;
  BETTER_AUTH_DATABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
}

export interface ApplicationUserRow { id: string; username: string; full_name: string; role: string | null; permissions: unknown; is_active: boolean | null; created_at: string | null; password_hash?: string | null; }
export interface ApplicationIdentityLinkRow { better_auth_user_id: string; application_user_id: string; }
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
export interface BetterAuthDatabaseHandle { adapter: AdapterFactory<any>; application: ApplicationAuthDatabase; close(): Promise<void>; }

function getSupabaseCredentials(env: BetterAuthDatabaseEnv): { url: string; key: string } {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) throw new Error('SUPABASE_URL is required for the production auth database transport.');
  if (!key) throw new Error('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required for the production auth database transport.');
  return { url, key };
}
function createSupabaseAdmin(env: BetterAuthDatabaseEnv): SupabaseClient {
  const { url, key } = getSupabaseCredentials(env);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function createSupabaseApplicationDatabase(client: SupabaseClient): ApplicationAuthDatabase {
  const callAdapter = async (operation: string, input: Record<string, unknown> = {}) => {
    const { data, error } = await client.rpc('solmint_better_auth_adapter', {
      p_operation: operation, p_model: input.model ?? null, p_data: input.data ?? {}, p_where: input.where ?? [],
      p_limit: input.limit ?? null, p_offset: input.offset ?? 0, p_sort: input.sort ?? null,
      p_increment: input.increment ?? {}, p_set: input.set ?? {},
    });
    if (error) throw error;
    return data;
  };
  return {
    async findApplicationUserByUsername(username) {
      const { data, error } = await client.from('users').select('id,username,full_name,role,permissions,is_active,created_at,password_hash').eq('username', username.trim().toLowerCase()).limit(1).maybeSingle();
      if (error) throw error; return data as ApplicationUserRow | null;
    },
    async findIdentityByApplicationUserId(applicationUserId) {
      const { data, error } = await client.from('auth_identity_links').select('better_auth_user_id,application_user_id').eq('application_user_id', applicationUserId).limit(1).maybeSingle();
      if (error) throw error; return data as ApplicationIdentityLinkRow | null;
    },
    async findIdentityByBetterAuthUserId(betterAuthUserId) {
      const { data, error } = await client.from('auth_identity_links').select('application_user_id, users!inner(id,username,full_name,role,permissions,is_active,created_at)').eq('better_auth_user_id', betterAuthUserId).limit(1).maybeSingle();
      if (error) throw error;
      const row = data as unknown as { application_user_id?: string; users?: ApplicationUserRow | ApplicationUserRow[] | null } | null;
      const related = Array.isArray(row?.users) ? row?.users[0] : row?.users;
      return row?.application_user_id && related ? ({ ...related } as ApplicationUserRow) : null;
    },
    async findBetterAuthIdentityByEmail(email) {
      const record = await callAdapter('find_one', { model: 'user', where: [{ field: 'email', value: email, operator: 'eq' }], limit: 1, offset: 0 }) as { id?: string } | null;
      return record?.id ? { id: record.id } : null;
    },
    async findBetterAuthSessionToken(sessionId, userId) {
      const record = await callAdapter('find_one', { model: 'session', where: [{ field: 'id', value: sessionId, operator: 'eq' }, { field: 'user_id', value: userId, operator: 'eq' }, { field: 'expires_at', value: new Date().toISOString(), operator: 'gt' }], limit: 1, offset: 0 }) as { token?: string } | null;
      return record?.token ? String(record.token) : null;
    },
    async createApplicationUser(input) {
      const { error } = await client.from('users').insert({ id: input.id, username: input.username, full_name: input.fullName, password_hash: input.passwordHash, role: 'user', permissions: [], is_active: true, created_at: input.createdAt });
      if (error) throw error;
    },
    async linkIdentity(input) {
      const { error } = await client.from('auth_identity_links').upsert({ better_auth_user_id: input.betterAuthUserId, application_user_id: input.applicationUserId, source: input.source }, { onConflict: 'better_auth_user_id' });
      if (error) throw error;
    },
    async deleteApplicationUser(applicationUserId) {
      const { error } = await client.from('users').delete().eq('id', applicationUserId); if (error) throw error;
    },
    async deleteBetterAuthUser(betterAuthUserId) { await callAdapter('delete', { model: 'user', where: [{ field: 'id', value: betterAuthUserId, operator: 'eq' }] }); },
  };
}
export function createBetterAuthDatabase(env: BetterAuthDatabaseEnv): BetterAuthDatabaseHandle {
  const client = createSupabaseAdmin(env);
  return { adapter: createSupabaseBetterAuthAdapter({ client }), application: createSupabaseApplicationDatabase(client), close: async () => {} };
}
