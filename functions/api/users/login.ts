import {
  type Env,
  checkLoginRateLimit,
  clearLoginRateLimit,
  createSession,
  findUser,
  jsonResponse,
  recordFailedLogin,
  sessionCookie,
  toSafeUser,
  upgradePasswordHash,
  verifyPassword
} from '../auth/_shared';

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const body = await request.json() as { username?: unknown; password?: unknown; passwordHash?: unknown; passcode?: unknown };
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password ?? body.passcode ?? '').trim();

    if (!username || !password || username.length > 128 || password.length > 1024) {
      return jsonResponse({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' }, 401);
    }

    if (!(await checkLoginRateLimit(env, request, username))) {
      return jsonResponse({ success: false, message: 'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً بعداً دوباره تلاش کنید.' }, 429, { 'Retry-After': '900' });
    }

    const user = await findUser(env, username);
    if (!user || user.is_active === false) {
      await recordFailedLogin(env, request, username);
      return jsonResponse({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' }, 401);
    }

    const verification = await verifyPassword(password, user.password_hash);
    if (!verification.valid) {
      await recordFailedLogin(env, request, username);
      return jsonResponse({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' }, 401);
    }

    if (verification.upgradedHash) {
      await upgradePasswordHash(env, user.id, verification.upgradedHash);
    }

    const token = await createSession(env, user);
    await clearLoginRateLimit(env, request, username);

    return jsonResponse(
      { success: true, user: toSafeUser(user), isSuperAdmin: user.role === 'superadmin' },
      200,
      { 'Set-Cookie': sessionCookie(token) }
    );
  } catch (error) {
    console.error('Production user login error:', error);
    return jsonResponse({ success: false, message: 'سرویس احراز هویت سرور در دسترس نیست.' }, 503);
  }
};
