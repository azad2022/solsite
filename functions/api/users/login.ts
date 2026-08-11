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

function requestId(): string {
  return `AUTH-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function logAuth(id: string, stage: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ scope: 'auth-login', requestId: id, stage, ...details }));
}

function safeError(error: unknown): { name?: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: error.message.slice(0, 500) };
  return { message: String(error).slice(0, 500) };
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const id = requestId();
  const responseHeaders = { 'X-Auth-Request-ID': id };
  logAuth(id, 'request:start', { method: request.method, path: new URL(request.url).pathname });

  try {
    let body: { username?: unknown; password?: unknown; passwordHash?: unknown; passcode?: unknown };
    try {
      body = await request.json() as typeof body;
      logAuth(id, 'request:body_parsed', { hasUsername: typeof body.username === 'string', hasPassword: typeof body.password === 'string' || typeof body.passcode === 'string' });
    } catch (error) {
      logAuth(id, 'request:body_parse_failed', { error: safeError(error) });
      return jsonResponse({ success: false, message: 'درخواست ورود نامعتبر است.', requestId: id }, 400, responseHeaders);
    }

    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password ?? body.passcode ?? '').trim();
    if (!username || !password || username.length > 128 || password.length > 1024) {
      logAuth(id, 'validation:failed', { hasUsername: Boolean(username), hasPassword: Boolean(password), usernameLength: username.length, passwordLength: password.length });
      return jsonResponse({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.', requestId: id }, 401, responseHeaders);
    }

    logAuth(id, 'rate_limit:start');
    let allowed: boolean;
    try {
      allowed = await checkLoginRateLimit(env, request, username);
      logAuth(id, 'rate_limit:success', { allowed });
    } catch (error) {
      logAuth(id, 'rate_limit:error', { error: safeError(error) });
      return jsonResponse({ success: false, message: 'سرویس محدودکننده تلاش‌های ورود در دسترس نیست.', requestId: id }, 503, responseHeaders);
    }
    if (!allowed) {
      logAuth(id, 'rate_limit:blocked');
      return jsonResponse({ success: false, message: 'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً بعداً دوباره تلاش کنید.', requestId: id }, 429, { ...responseHeaders, 'Retry-After': '900' });
    }

    logAuth(id, 'user_lookup:start');
    let user: Awaited<ReturnType<typeof findUser>>;
    try {
      user = await findUser(env, username);
      logAuth(id, 'user_lookup:success', { found: Boolean(user), active: user?.is_active ?? null });
    } catch (error) {
      logAuth(id, 'user_lookup:error', { error: safeError(error) });
      return jsonResponse({ success: false, message: 'سرویس احراز هویت سرور در دسترس نیست.', requestId: id }, 503, responseHeaders);
    }
    if (!user || user.is_active === false) {
      logAuth(id, 'credentials:rejected', { reason: !user ? 'user_not_found' : 'user_inactive' });
      try { await recordFailedLogin(env, request, username); } catch (error) { logAuth(id, 'rate_limit:record_failure_error', { error: safeError(error) }); }
      return jsonResponse({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.', requestId: id }, 401, responseHeaders);
    }

    logAuth(id, 'password_verify:start', { hashFormat: user.password_hash.startsWith('pbkdf2-sha256$') ? 'pbkdf2' : user.password_hash.startsWith('scrypt$') ? 'scrypt' : /^[a-f0-9]{64}$/i.test(user.password_hash) ? 'legacy-sha256' : 'unknown' });
    let verification: Awaited<ReturnType<typeof verifyPassword>>;
    try {
      verification = await verifyPassword(password, user.password_hash);
      logAuth(id, 'password_verify:success', { valid: verification.valid, upgraded: Boolean(verification.upgradedHash) });
    } catch (error) {
      logAuth(id, 'password_verify:error', { error: safeError(error) });
      return jsonResponse({ success: false, message: 'خطا در بررسی رمز عبور.', requestId: id }, 500, responseHeaders);
    }
    if (!verification.valid) {
      logAuth(id, 'credentials:rejected', { reason: 'password_mismatch' });
      try { await recordFailedLogin(env, request, username); } catch (error) { logAuth(id, 'rate_limit:record_failure_error', { error: safeError(error) }); }
      return jsonResponse({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.', requestId: id }, 401, responseHeaders);
    }

    if (verification.upgradedHash) {
      logAuth(id, 'password_upgrade:start');
      try {
        await upgradePasswordHash(env, user.id, verification.upgradedHash);
        logAuth(id, 'password_upgrade:success');
      } catch (error) {
        logAuth(id, 'password_upgrade:error', { error: safeError(error) });
        return jsonResponse({ success: false, message: 'خطا در به‌روزرسانی امن رمز عبور.', requestId: id }, 500, responseHeaders);
      }
    }

    logAuth(id, 'session_create:start');
    let token: string;
    try {
      token = await createSession(env, user);
      logAuth(id, 'session_create:success');
    } catch (error) {
      logAuth(id, 'session_create:error', { error: safeError(error) });
      return jsonResponse({ success: false, message: 'خطا در ایجاد نشست کاربری.', requestId: id }, 503, responseHeaders);
    }

    try {
      await clearLoginRateLimit(env, request, username);
      logAuth(id, 'rate_limit:cleared');
    } catch (error) {
      logAuth(id, 'rate_limit:clear_error', { error: safeError(error) });
    }

    logAuth(id, 'login:success', { userId: user.id, role: user.role });
    return jsonResponse(
      { success: true, user: toSafeUser(user), isSuperAdmin: user.role === 'superadmin', requestId: id },
      200,
      { ...responseHeaders, 'Set-Cookie': sessionCookie(token) }
    );
  } catch (error) {
    logAuth(id, 'request:fatal_error', { error: safeError(error) });
    return jsonResponse({ success: false, message: 'سرویس احراز هویت سرور در دسترس نیست.', requestId: id }, 503, responseHeaders);
  }
};
