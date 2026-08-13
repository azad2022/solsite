import { getAuthenticatedUser, getSessionToken, jsonResponse, type Env } from '../auth/_shared';

type MediaEnv = Env & {
  SUPABASE_URL?: string;
};

const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const ALLOWED_ACTIONS = new Set(['config', 'assets', 'test-connection', 'upload', 'delete', 'migrate']);

function getSupabaseUrl(env: MediaEnv) {
  return (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
}

function actionFor(action: string) {
  switch (action) {
    case 'config': return 'get-config';
    case 'assets': return 'list';
    case 'test-connection': return 'test';
    default: return action;
  }
}

export const onRequest = async ({ request, env, params }: { request: Request; env: MediaEnv; params: Record<string, string> }) => {
  const action = String(params?.action || '').trim();
  if (!ALLOWED_ACTIONS.has(action)) {
    return jsonResponse({ success: false, errorCode: 'INVALID_MEDIA_ACTION', message: 'عملیات رسانه نامعتبر است.' }, 404);
  }
  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse({ success: false, errorCode: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' }, 405, { Allow: 'GET, POST' });
  }

  const sessionToken = getSessionToken(request);
  if (!sessionToken) {
    console.warn('Media auth rejected: session cookie missing', { action });
    return jsonResponse({
      success: false,
      errorCode: 'MEDIA_ADMIN_SESSION_MISSING',
      stage: 'cookie',
      message: 'نشست مدیر در درخواست رسانه ارسال نشده است. لطفاً دوباره وارد پنل شوید.'
    }, 401);
  }

  let user;
  try {
    user = await getAuthenticatedUser(env, request);
  } catch (error) {
    console.error('Media auth validation threw', { action, error: error instanceof Error ? error.message : String(error) });
    return jsonResponse({
      success: false,
      errorCode: 'MEDIA_ADMIN_AUTH_VALIDATION_ERROR',
      stage: 'session_validation',
      message: 'اعتبارسنجی نشست مدیر در سرور ناموفق بود.'
    }, 503);
  }

  if (!user) {
    console.warn('Media auth rejected: session validation failed', { action, hasSessionCookie: true });
    return jsonResponse({
      success: false,
      errorCode: 'MEDIA_ADMIN_SESSION_INVALID',
      stage: 'session_validation',
      message: 'نشست مدیر معتبر نیست یا منقضی شده است. لطفاً دوباره وارد پنل شوید.'
    }, 401);
  }

  if (user.is_active === false) {
    console.warn('Media auth rejected: inactive admin', { action, role: user.role });
    return jsonResponse({
      success: false,
      errorCode: 'MEDIA_ADMIN_INACTIVE',
      stage: 'user_status',
      message: 'حساب مدیر غیرفعال است.'
    }, 403);
  }

  if (!['admin', 'superadmin'].includes(String(user.role))) {
    console.warn('Media auth rejected: insufficient role', { action, role: user.role });
    return jsonResponse({
      success: false,
      errorCode: 'MEDIA_ADMIN_ROLE_DENIED',
      stage: 'authorization',
      message: 'این حساب مجوز مدیریت کتابخانه تصاویر را ندارد.'
    }, 403);
  }

  const upstreamBody = request.method === 'POST'
    ? await request.json().catch(() => ({}))
    : {};
  const payload = { ...(upstreamBody && typeof upstreamBody === 'object' ? upstreamBody : {}), action: actionFor(action) };

  try {
    const upstream = await fetch(`${getSupabaseUrl(env)}/functions/v1/github-media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-solmint-session': sessionToken,
        'x-media-gateway-version': '4',
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }

    if (!upstream.ok) {
      console.error('Media upstream failure', {
        action,
        upstreamStatus: upstream.status,
        errorCode: data?.errorCode || null,
        stage: data?.stage || null,
      });
      return jsonResponse(
        data || {
          success: false,
          errorCode: 'MEDIA_UPSTREAM_HTTP_ERROR',
          message: `سرویس کتابخانه تصاویر پاسخ HTTP ${upstream.status} داد.`
        },
        upstream.status >= 500 ? 503 : upstream.status
      );
    }

    return jsonResponse(data || { success: true }, 200);
  } catch (error) {
    console.error('Media gateway network error', { action, error: error instanceof Error ? error.message : String(error) });
    return jsonResponse({
      success: false,
      errorCode: 'MEDIA_UPSTREAM_UNREACHABLE',
      stage: 'supabase_edge_function',
      message: 'اتصال server-to-server به سرویس کتابخانه تصاویر برقرار نشد.'
    }, 503);
  }
};
