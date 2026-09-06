import { createBetterAuthRuntime } from '../auth/_instance';
import { getAuthenticatedUser, jsonResponse, toSafeUser } from '../auth/_shared';

export const onRequestGet = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const legacyUser = await getAuthenticatedUser(env, request);
    if (legacyUser) {
      return jsonResponse({ success: true, user: toSafeUser(legacyUser), isSuperAdmin: legacyUser.role === 'superadmin' });
    }

    const runtime = createBetterAuthRuntime(env);
    try {
      const session = await runtime.auth.api.getSession({ headers: request.headers });
      if (!session?.user) return jsonResponse({ success: false, message: 'نشست معتبر نیست.' }, 401);

      const betterAuthUser = session.user as typeof session.user & { username?: string | null; name?: string | null };
      const link = await runtime.database.query(
        'select legacy_user_id from public.auth_identity_links where better_auth_user_id = $1 limit 1',
        [String(betterAuthUser.id)],
      );
      const legacyUserId = link.rows[0]?.legacy_user_id ? String(link.rows[0].legacy_user_id) : null;

      let applicationUser: { id: string; username: string; full_name: string; role: string; permissions: unknown; is_active: boolean; created_at: string } | null = null;
      if (legacyUserId) {
        const result = await runtime.database.query(
          'select id, username, full_name, role, permissions, is_active, created_at from public.users where id = $1 limit 1',
          [legacyUserId],
        );
        applicationUser = result.rows[0] || null;
      }

      if (applicationUser?.is_active === false) {
        return jsonResponse({ success: false, message: 'نشست معتبر نیست.' }, 401);
      }

      const user = {
        id: String(betterAuthUser.id),
        username: String(applicationUser?.username || betterAuthUser.username || betterAuthUser.email),
        fullName: String(applicationUser?.full_name || betterAuthUser.name || betterAuthUser.email || 'کاربر سولمینت'),
        role: String(applicationUser?.role || 'user'),
        permissions: Array.isArray(applicationUser?.permissions) ? applicationUser.permissions : [],
        isActive: applicationUser?.is_active !== false,
        createdAt: new Date(betterAuthUser.createdAt).toISOString(),
      };

      return jsonResponse({ success: true, user, isSuperAdmin: user.role === 'superadmin' });
    } finally {
      if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
        await runtime.database.end().catch(() => {});
      }
    }
  } catch (error) {
    console.error('Session identity error:', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse({ success: false, message: 'سرویس احراز هویت در دسترس نیست.' }, 503);
  }
};
