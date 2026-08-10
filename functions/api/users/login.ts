import {
  type Env,
  createSession,
  findUser,
  jsonResponse,
  sessionCookie,
  toSafeUser,
  upgradePasswordHash,
  verifyPassword
} from '../auth/_shared';

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const body = await request.json() as { username?: unknown; password?: unknown; passwordHash?: unknown; passcode?: unknown };
    const username = String(body.username || '').trim().toLowerCase();
    // The browser must send the password over HTTPS to the server. Client-side hashing is not authentication.
    const password = String(body.password ?? body.passcode ?? '').trim();

    if (!username || !password) {
      return jsonResponse({ success: false, message: 'نام کاربری و رمز عبور الزامی است.' }, 400);
    }

    const user = await findUser(env, username);
    if (!user || user.is_active === false) {
      return jsonResponse({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' }, 401);
    }

    const verification = await verifyPassword(password, user.password_hash);
    if (!verification.valid) {
      return jsonResponse({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' }, 401);
    }

    // Transparently upgrade the old unsalted SHA-256 password hash after a successful login.
    if (verification.upgradedHash) {
      await upgradePasswordHash(env, user.id, verification.upgradedHash);
    }

    const token = await createSession(env, user);
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
