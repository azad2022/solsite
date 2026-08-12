import {
  createSession,
  findUser,
  hashPassword,
  jsonResponse,
  sessionCookie,
  toSafeUser,
  type Env,
  SupabaseUpstreamError,
} from '../auth/_shared';

function requestId(): string {
  return `REG-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function logRegister(id: string, stage: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ scope: 'auth-register', requestId: id, stage, ...details }));
}

function validateUsername(username: string): boolean {
  return username.length >= 3 && username.length <= 30 && /^[\w\d_@.\u0600-\u06FF\s-]+$/u.test(username);
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const id = requestId();
  const responseHeaders = { 'X-Register-Request-ID': id };
  logRegister(id, 'request:start', { method: request.method });

  try {
    let body: { username?: unknown; fullName?: unknown; password?: unknown; role?: unknown };
    try {
      body = await request.json() as typeof body;
    } catch {
      logRegister(id, 'request:body_parse_failed');
      return jsonResponse({ success: false, message: 'درخواست ثبت‌نام نامعتبر است.', requestId: id }, 400, responseHeaders);
    }

    const username = String(body.username ?? '').trim().toLowerCase();
    const fullName = String(body.fullName ?? '').trim();
    const password = String(body.password ?? '');

    if (!validateUsername(username)) {
      return jsonResponse({ success: false, message: 'نام کاربری باید بین ۳ تا ۳۰ کاراکتر و شامل حروف، اعداد، فاصله، خط تیره یا _ باشد.', requestId: id }, 400, responseHeaders);
    }
    if (fullName.length < 2 || fullName.length > 100) {
      return jsonResponse({ success: false, message: 'نام و نام خانوادگی معتبر نیست.', requestId: id }, 400, responseHeaders);
    }
    if (password.length < 8 || password.length > 1024) {
      return jsonResponse({ success: false, message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.', requestId: id }, 400, responseHeaders);
    }

    logRegister(id, 'user_lookup:start', { username });
    let existingUser;
    try {
      existingUser = await findUser(env, username);
    } catch (error) {
      const upstreamStatus = error instanceof SupabaseUpstreamError ? error.status : undefined;
      logRegister(id, 'user_lookup:error', { upstreamStatus });
      return jsonResponse({ success: false, message: 'سرویس ثبت‌نام سرور در دسترس نیست.', requestId: id, diagnostic: { stage: 'user_lookup', upstreamStatus } }, 503, responseHeaders);
    }

    if (existingUser) {
      logRegister(id, 'registration:duplicate');
      return jsonResponse({ success: false, message: 'این نام کاربری قبلاً ثبت شده است.', requestId: id }, 409, responseHeaders);
    }

    const passwordHash = await hashPassword(password);
    const user = {
      id: `usr-${crypto.randomUUID()}`,
      username,
      full_name: fullName,
      password_hash: passwordHash,
      role: 'user',
      permissions: ['articles', 'editor', 'comments', 'media'],
      is_active: true,
    };

    logRegister(id, 'user_create:start');
    let createdUser: any;
    try {
      const response = await fetch(
        `${(env.SUPABASE_URL || 'https://nvopkbiedorfshwbmyhn.supabase.co').replace(/\/$/, '')}/rest/v1/users`,
        {
          method: 'POST',
          headers: {
            apikey: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '',
            Authorization: `Bearer ${env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(user),
        }
      );
      if (!response.ok) {
        const bodyText = (await response.text()).slice(0, 1000);
        if (response.status === 409 || /duplicate|unique|already exists/i.test(bodyText)) {
          return jsonResponse({ success: false, message: 'این نام کاربری قبلاً ثبت شده است.', requestId: id }, 409, responseHeaders);
        }
        throw new SupabaseUpstreamError(response.status, bodyText);
      }
      const rows = await response.json() as any[];
      createdUser = rows?.[0] || user;
    } catch (error) {
      const upstreamStatus = error instanceof SupabaseUpstreamError ? error.status : undefined;
      logRegister(id, 'user_create:error', { upstreamStatus });
      return jsonResponse({ success: false, message: 'ثبت حساب کاربری در دیتابیس انجام نشد.', requestId: id, diagnostic: { stage: 'user_create', upstreamStatus } }, 503, responseHeaders);
    }

    const authUser = {
      id: createdUser.id,
      username: createdUser.username,
      full_name: createdUser.full_name,
      role: createdUser.role,
      permissions: createdUser.permissions,
      is_active: createdUser.is_active,
      created_at: createdUser.created_at || new Date().toISOString(),
    };

    logRegister(id, 'session_create:start');
    let token: string;
    try {
      token = await createSession(env, authUser);
    } catch (error) {
      logRegister(id, 'session_create:error', { error: error instanceof Error ? error.message.slice(0, 300) : String(error) });
      return jsonResponse({ success: false, message: 'حساب ساخته شد اما ورود خودکار انجام نشد. لطفاً دوباره وارد شوید.', requestId: id, diagnostic: { stage: 'session_create' } }, 503, responseHeaders);
    }

    logRegister(id, 'registration:success', { userId: authUser.id });
    return jsonResponse(
      {
        success: true,
        message: 'حساب کاربری با موفقیت ساخته شد.',
        user: toSafeUser(authUser),
        requestId: id,
      },
      201,
      { ...responseHeaders, 'Set-Cookie': sessionCookie(token) }
    );
  } catch (error) {
    logRegister(id, 'request:fatal_error', { error: error instanceof Error ? error.message.slice(0, 300) : String(error) });
    return jsonResponse({ success: false, message: 'سرویس ثبت‌نام در دسترس نیست.', requestId: id }, 503, responseHeaders);
  }
};
