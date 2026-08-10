import { getAuthenticatedUser, jsonResponse, findUser, verifyPassword, upgradePasswordHash } from '../auth/_shared';

export const onRequestPost = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const sessionUser = await getAuthenticatedUser(env, request);
    if (!sessionUser) return jsonResponse({ success: false, message: 'نشست معتبر نیست.' }, 401);

    const body = await request.json().catch(() => ({})) as { currentPassword?: unknown; newPassword?: unknown };
    const currentPassword = String(body.currentPassword || '').trim();
    const newPassword = String(body.newPassword || '').trim();

    if (!currentPassword || newPassword.length < 8) {
      return jsonResponse({ success: false, message: 'رمز عبور فعلی و رمز جدید معتبر الزامی است.' }, 400);
    }
    if (currentPassword === newPassword) {
      return jsonResponse({ success: false, message: 'رمز عبور جدید باید با رمز فعلی متفاوت باشد.' }, 400);
    }

    const user = await findUser(env, sessionUser.username);
    if (!user) return jsonResponse({ success: false, message: 'کاربر احراز هویت‌شده یافت نشد.' }, 404);

    const verification = await verifyPassword(currentPassword, user.password_hash);
    if (!verification.valid) return jsonResponse({ success: false, message: 'رمز عبور فعلی اشتباه است.' }, 401);

    // The shared verifier uses PBKDF2 for newly stored passwords.
    const cryptoSalt = new Uint8Array(16);
    crypto.getRandomValues(cryptoSalt);
    const salt = Array.from(cryptoSalt).map(b => b.toString(16).padStart(2, '0')).join('');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(newPassword), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: cryptoSalt, iterations: 310000, hash: 'SHA-256' }, key, 256);
    const derived = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    await upgradePasswordHash(env, user.id, `pbkdf2-sha256$310000$${salt}$${derived}`);

    return jsonResponse({ success: true, message: 'رمز عبور با موفقیت تغییر کرد.' });
  } catch (error) {
    console.error('Password change error:', error);
    return jsonResponse({ success: false, message: 'تغییر رمز عبور انجام نشد.' }, 503);
  }
};
