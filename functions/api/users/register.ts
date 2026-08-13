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
  return username.length >= 3 && username.length <= 30 && /^[\w\d_@.\u0600-\u06FF -]+$/u.test(username);
}

function normalizeFullName(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function consumeRegistrationRateLimit(env: Env, request: Request, username: string, secret: string): Promise<boolean> {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
  const sourceSecret = env.AUTH_RATE_LIMIT_SECRET || secret;
  const keyHash = await sha256(`${sourceSecret}:register:${ip}:${username}`);
  const base = (env.SUPABASE_URL || 'https://nvopkbiedorfshwbmyhn.supabase.co').replace(/\/$/, '');
  const response = await fetch(`${base}/rest/v1/rpc/consume_registration_rate_limit`, {
    method: 'POST',
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_key_hash: keyHash, p_window_seconds: 3600, p_max_requests: 5 })
  });
  if (!response.ok) throw new Error(`registration rate limiter failed: ${response.status}`);
  return Boolean(await response.json());
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const id = requestId();
  const responseHeaders = { 'X-Register-Request-ID': id };
  try {
    let body: { username?: unknown; fullName?: unknown; password?: unknown; role?: unknown };
    try { body = await request.json() as typeof body; }
    catch { return jsonResponse({ success: false, message: 'درخواست ثبت‌نام نامعتبر است.', requestId: id }, 400, responseHeaders); }

    const username = String(body.username ?? '').trim().toLowerCase();
    const fullName = normalizeFullName(String(body.fullName ?? ''));
    const password = String(body.password ?? '');
    if (!validateUsername(username)) return jsonResponse({ success: false, message: 'نام کاربری باید بین ۳ تا ۳۰ کاراکتر و شامل حروف، اعداد، فاصله، خط تیره یا _ باشد.', requestId: id }, 400, responseHeaders);
    if (fullName.length < 2 || fullName.length > 100) return jsonResponse({ success: false, message: 'نام و نام خانوادگی معتبر نیست.', requestId: id }, 400, responseHeaders);
    if (password.length < 8 || password.length > 1024) return jsonResponse({ success: false, message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.', requestId: id }, 400, responseHeaders);

    const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!secret) return jsonResponse({ success: false, message: 'سرویس ثبت‌نام سرور پیکربندی نشده است.', requestId: id }, 503, responseHeaders);

    let allowed: boolean;
    try { allowed = await consumeRegistrationRateLimit(env, request, username, secret); }
    catch (error) { logRegister(id, 'registration:rate_limit_error', { error: error instanceof Error ? error.message.slice(0, 200) : String(error) }); return jsonResponse({ success: false, message: 'سرویس کنترل ثبت‌نام موقتاً در دسترس نیست.', requestId: id }, 503, responseHeaders); }
    if (!allowed) return jsonResponse({ success: false, message: 'تعداد تلاش‌های ثبت‌نام از این نشانی بیش از حد مجاز است. لطفاً بعداً دوباره تلاش کنید.', requestId: id }, 429, { ...responseHeaders, 'Retry-After': '3600' });

    let existingUser;
    try { existingUser = await findUser(env, username); }
    catch (error) { const upstreamStatus = error instanceof SupabaseUpstreamError ? error.status : undefined; return jsonResponse({ success: false, message: 'سرویس ثبت‌نام سرور در دسترس نیست.', requestId: id, diagnostic: { stage: 'user_lookup', upstreamStatus } }, 503, responseHeaders); }
    if (existingUser) return jsonResponse({ success: false, message: 'این نام کاربری قبلاً ثبت شده است.', requestId: id }, 409, responseHeaders);

    const passwordHash = await hashPassword(password);
    const user = { id: `usr-${crypto.randomUUID()}`, username, full_name: fullName, password_hash: passwordHash, role: 'user', permissions: [], is_active: true };

    let createdUser: any;
    try {
      const response = await fetch(`${(env.SUPABASE_URL || 'https://nvopkbiedorfshwbmyhn.supabase.co').replace(/\/$/, '')}/rest/v1/users`, {
        method: 'POST',
        headers: { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(user),
      });
      if (!response.ok) {
        const bodyText = (await response.text()).slice(0, 1000);
        if (response.status === 409 || /duplicate|unique|already exists/i.test(bodyText)) return jsonResponse({ success: false, message: 'این نام کاربری قبلاً ثبت شده است.', requestId: id }, 409, responseHeaders);
        throw new SupabaseUpstreamError(response.status, bodyText);
      }
      const rows = await response.json() as any[];
      createdUser = rows?.[0] || user;
    } catch (error) {
      const upstreamStatus = error instanceof SupabaseUpstreamError ? error.status : undefined;
      return jsonResponse({ success: false, message: 'ثبت حساب کاربری در دیتابیس انجام نشد.', requestId: id, diagnostic: { stage: 'user_create', upstreamStatus } }, 503, responseHeaders);
    }

    const authUser = { id: createdUser.id, username: createdUser.username, full_name: createdUser.full_name, role: createdUser.role, permissions: createdUser.permissions, is_active: createdUser.is_active, created_at: createdUser.created_at || new Date().toISOString() };
    let token: string;
    try { token = await createSession(env, authUser); }
    catch { return jsonResponse({ success: false, message: 'حساب ساخته شد اما ورود خودکار انجام نشد. لطفاً دوباره وارد شوید.', requestId: id, diagnostic: { stage: 'session_create' } }, 503, responseHeaders); }
    return jsonResponse({ success: true, message: 'حساب کاربری با موفقیت ساخته شد.', user: toSafeUser(authUser), requestId: id }, 201, { ...responseHeaders, 'Set-Cookie': sessionCookie(token) });
  } catch (error) {
    logRegister(id, 'request:fatal_error', { error: error instanceof Error ? error.message.slice(0, 300) : String(error) });
    return jsonResponse({ success: false, message: 'سرویس ثبت‌نام در دسترس نیست.', requestId: id }, 503, responseHeaders);
  }
};
