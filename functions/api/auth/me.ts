import { getBetterAuthApplicationUser, type BetterAuthApplicationSessionEnv } from './_application-session';
import { getAuthenticatedUser, jsonResponse, toSafeUser } from './_shared';

export const onRequestGet = async ({ request, env }: { request: Request; env: BetterAuthApplicationSessionEnv }) => {
  try {
    // Compatibility during controlled migration: legacy sessions remain readable,
    // but new Better Auth sessions are resolved through the single application boundary.
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
