import { getAuthenticatedUser, jsonResponse, toSafeUser } from '../auth/_shared';

export const onRequestGet = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const user = await getAuthenticatedUser(env, request);
    if (!user) return jsonResponse({ success: false, message: 'نشست معتبر نیست.' }, 401);
    return jsonResponse({ success: true, user: toSafeUser(user), isSuperAdmin: user.role === 'superadmin' });
  } catch (error) {
    console.error('Session identity error:', error);
    return jsonResponse({ success: false, message: 'سرویس احراز هویت در دسترس نیست.' }, 503);
  }
};
