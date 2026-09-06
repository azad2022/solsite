import { getAuthenticatedUser, jsonResponse, toSafeUser, type Env } from './_shared';
import { createBetterAuth } from './_instance';

type BetterAuthCompatibleEnv = Env & {
  NODE_ENV?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  HYPERDRIVE?: { connectionString?: string };
};

async function getBetterAuthUser(request: Request, env: BetterAuthCompatibleEnv) {
  try {
    const auth = createBetterAuth(env);
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return null;

    const user = session.user as typeof session.user & {
      username?: string | null;
      name?: string | null;
    };

    return {
      id: String(user.id),
      username: String(user.username || user.email || user.id),
      fullName: String(user.name || user.email || 'کاربر سولمینت'),
      role: 'user' as const,
      permissions: [],
      isActive: true,
      createdAt: new Date(user.createdAt).toISOString(),
    };
  } catch (error) {
    console.error('Better Auth session lookup failed:', error instanceof Error ? error.message : 'unknown error');
    return null;
  }
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
      isSuperAdmin: false,
    });
  } catch (error) {
    console.error('Auth session validation error:', error);
    return jsonResponse({ success: false, authenticated: false }, 503);
  }
};
