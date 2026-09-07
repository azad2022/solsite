import { createBetterAuthRuntime } from '../auth/_instance';
import { getAuthenticatedUser, jsonResponse, toSafeUser, type Env } from '../auth/_shared';

interface BetterAuthUsersMeEnv extends Env {
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
}

async function getBetterAuthApplicationUser(request: Request, env: BetterAuthUsersMeEnv) {
  const runtime = createBetterAuthRuntime(env);
  try {
    const session = await runtime.auth.api.getSession({ headers: request.headers });
    if (!session?.user) return null;

    const user = session.user;
    const result = await runtime.database.query<{
      application_user_id: string;
      username: string | null;
      full_name: string | null;
      role: string | null;
      permissions: unknown;
      is_active: boolean | null;
      created_at: string | null;
    }>(
      `select l.application_user_id,
              u.username,
              u.full_name,
              u.role,
              u.permissions,
              u.is_active,
              u.created_at
       from public.auth_identity_links l
       join public.users u on u.id = l.application_user_id
       where l.better_auth_user_id = $1
       limit 1`,
      [String(user.id)],
    );

    const applicationUser = result.rows[0];
    if (!applicationUser || applicationUser.is_active === false || applicationUser.is_active == null) return null;

    return {
      id: String(user.id),
      username: String(applicationUser.username),
      fullName: String(applicationUser.full_name || user.name || user.email || 'کاربر سولمینت'),
      role: applicationUser.role || 'user',
      permissions: Array.isArray(applicationUser.permissions) ? applicationUser.permissions : [],
      isActive: true,
      createdAt: applicationUser.created_at || new Date(user.createdAt).toISOString(),
    };
  } finally {
    if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
      await runtime.database.end().catch(() => {});
    }
  }
}

export const onRequestGet = async ({ request, env }: { request: Request; env: BetterAuthUsersMeEnv }) => {
  try {
    const legacyUser = await getAuthenticatedUser(env, request);
    if (legacyUser) {
      return jsonResponse({ success: true, authenticated: true, user: toSafeUser(legacyUser), isSuperAdmin: legacyUser.role === 'superadmin' });
    }

    const betterAuthUser = await getBetterAuthApplicationUser(request, env);
    if (!betterAuthUser) return jsonResponse({ success: false, authenticated: false }, 401);

    return jsonResponse({
      success: true,
      authenticated: true,
      user: betterAuthUser,
      isSuperAdmin: betterAuthUser.role === 'superadmin',
    });
  } catch (error) {
    console.error('Session identity error:', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse({ success: false, authenticated: false }, 503);
  }
};
