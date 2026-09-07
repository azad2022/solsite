import { getBetterAuthApplicationUser } from '../auth/_application-session';
import { jsonResponse, type Env } from '../auth/_shared';

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const user = await getBetterAuthApplicationUser(request, env as never);
    if (!user) return jsonResponse({ success: false, authenticated: false }, 401);

    return jsonResponse({
      success: true,
      authenticated: true,
      user: {
        id: user.applicationUserId,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        permissions: user.permissions,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      isSuperAdmin: user.role === 'superadmin',
    });
  } catch (error) {
    console.error('Users me endpoint failed:', error instanceof Error ? error.message : String(error));
    return jsonResponse({ success: false, authenticated: false }, 503);
  }
};
