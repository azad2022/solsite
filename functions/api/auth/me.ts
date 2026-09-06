import { createBetterAuthRuntime } from './_instance';
import { findUser, getAuthenticatedUser, jsonResponse, toSafeUser, type Env } from './_shared';

type BetterAuthCompatibleEnv = Env & {
  NODE_ENV?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  BETTER_AUTH_DATABASE_URL?: string;
  HYPERDRIVE?: { connectionString: string };
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
};

async function getBetterAuthUser(request: Request, env: BetterAuthCompatibleEnv) {
  const runtime = createBetterAuthRuntime(env);
  try {
    const session = await runtime.auth.api.getSession({ headers: request.headers });
    if (!session?.user) return null;

    const user = session.user as typeof session.user & {
      username?: string | null;
      name?: string | null;
    };
    const link = await runtime.database.query(
      'select legacy_user_id from public.auth_identity_links where better_auth_user_id = $1 limit 1',
      [String(user.id)],
    );
    const legacyUserId = link.rows[0]?.legacy_user_id ? String(link.rows[0].legacy_user_id) : null;
    const legacyUser = legacyUserId ? await findUserById(env, legacyUserId) : null;

    if (legacyUser && legacyUser.is_active === false) return null;

    return {
      id: String(user.id),
      username: String(user.username || user.email || user.id),
      fullName: String(user.name || user.email || 'کاربر سولمینت'),
      role: legacyUser?.role || 'user',
      permissions: Array.isArray(legacyUser?.permissions) ? legacyUser.permissions : [],
      isActive: legacyUser?.is_active !== false,
      createdAt: new Date(user.createdAt).toISOString(),
    };
  } finally {
    if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
      await runtime.database.end().catch(() => {});
    }
  }
}

async function findUserById(env: BetterAuthCompatibleEnv, userId: string) {
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!secret) return null;
  const baseUrl = (env.SUPABASE_URL || 'https://nvopkbiedorfshwbmyhn.supabase.co').replace(/\/$/, '');
  const response = await fetch(
    `${baseUrl}/rest/v1/users?select=id,username,full_name,password_hash,role,permissions,is_active,created_at&id=eq.${encodeURIComponent(userId)}&limit=1`,
    { headers: { apikey: secret, ...(env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_SECRET_KEY ? { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } : {}) } },
  );
  if (!response.ok) return null;
  const rows = await response.json() as Array<{
    id: string;
    username: string;
    full_name: string;
    password_hash: string;
    role: string;
    permissions: unknown;
    is_active: boolean;
    created_at: string;
  }>;
  return rows[0] || null;
}

export const onRequestGet = async ({ request, env }: { request: Request; env: BetterAuthCompatibleEnv }) => {
  try {
    const legacyUser = await getAuthenticatedUser(env, request);
    if (legacyUser) {
      return jsonResponse({ success: true, authenticated: true, user: toSafeUser(legacyUser), isSuperAdmin: legacyUser.role === 'superadmin' });
    }

    const betterAuthUser = await getBetterAuthUser(request, env);
    if (!betterAuthUser) return jsonResponse({ success: false, authenticated: false }, 401);

    return jsonResponse({
      success: true,
      authenticated: true,
      user: betterAuthUser,
      isSuperAdmin: betterAuthUser.role === 'superadmin',
    });
  } catch {
    return jsonResponse({ success: false, authenticated: false }, 503);
  }
};
