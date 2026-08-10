import { getAuthenticatedUser, jsonResponse, toSafeUser, type Env } from './_shared';

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const user = await getAuthenticatedUser(env, request);
    if (!user) return jsonResponse({ success: false, authenticated: false }, 401);
    return jsonResponse({ success: true, authenticated: true, user: toSafeUser(user), isSuperAdmin: user.role === 'superadmin' });
  } catch (error) {
    console.error('Auth session validation error:', error);
    return jsonResponse({ success: false, authenticated: false }, 503);
  }
};
