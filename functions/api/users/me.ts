import { getBetterAuthApplicationUser } from '../auth/_application-session';
import { getAuthenticatedUser, jsonResponse, toSafeUser, type Env } from '../auth/_shared';

type EnvWithBetterAuth = Env & {
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

export const onRequestGet = async ({ request, env }: { request: Request; env: EnvWithBetterAuth }) => {
  try {
    // Keep this legacy URL as a compatibility surface during controlled migration.
    // Both legacy and Better Auth sessions resolve to the same application identity model.
    const legacyUser = await getAuthenticatedUser(env, request);
    if (legacyUser) {
      return jsonResponse({
        success: true,
        authenticated: true,
        user: toSafeUser(legacyUser),
        isSuperAdmin: legacyUser.role === 'superadmin',
      });
    }

    const betterAuthUser = await getBetterAuthApplicationUser(request, env);
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
