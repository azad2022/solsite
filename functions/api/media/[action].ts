import { getAuthenticatedUser, jsonResponse, type Env } from '../auth/_shared';

interface MediaEnv extends Env {
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
}

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const ALLOWED_ACTIONS = new Set(['config', 'assets', 'test-connection', 'upload', 'delete', 'migrate']);

function getSecret(env: MediaEnv): string {
  return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function getBaseUrl(env: MediaEnv): string {
  return (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
}

function safeErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message.slice(0, 500);
  return String(value || 'خطای ناشناخته سرویس رسانه').slice(0, 500);
}

async function callMediaFunction(env: MediaEnv, action: string, body: Record<string, unknown>) {
  const secret = getSecret(env);
  if (!secret) throw new Error('کلید سرور برای اتصال سرویس رسانه پیکربندی نشده است.');

  const response = await fetch(`${getBaseUrl(env)}/functions/v1/github-media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      'x-media-gateway-secret': secret,
    },
    body: JSON.stringify({ action, ...body }),
  });

  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  return {
    ok: response.ok,
    status: response.status,
    data,
    raw: text.slice(0, 1200),
  };
}

export const onRequest = async ({ request, env, params }: { request: Request; env: MediaEnv; params: Record<string, string> }) => {
  try {
    const action = String(params.action || '').trim();
    if (!ALLOWED_ACTIONS.has(action)) return jsonResponse({ success: false, message: 'عملیات رسانه نامعتبر است.' }, 404);

    if (request.method !== 'GET' && request.method !== 'POST') {
      return jsonResponse({ success: false, message: 'Method Not Allowed' }, 405, { Allow: 'GET, POST' });
    }

    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false || !['admin', 'superadmin'].includes(String(user.role))) {
      return jsonResponse({ success: false, message: 'نشست مدیریتی معتبر نیست یا دسترسی رسانه ندارید.' }, 401);
    }

    let payload: Record<string, unknown> = {};
    if (request.method === 'POST') {
      payload = await request.json().catch(() => ({}));
    }

    if (request.method === 'GET') {
      const result = await callMediaFunction(env, action, {});
      if (!result.ok) {
        return jsonResponse(result.data || { success: false, message: 'سرویس کتابخانه رسانه در دسترس نیست.' }, result.status || 502);
      }
      return jsonResponse(result.data || { success: false, message: 'پاسخ نامعتبر از سرویس رسانه دریافت شد.' }, 200);
    }

    const result = await callMediaFunction(env, action === 'config' ? 'save-config' : action, payload);
    if (!result.ok) {
      return jsonResponse(
        result.data || { success: false, message: 'سرویس کتابخانه رسانه در دسترس نیست.' },
        result.status >= 400 && result.status < 600 ? result.status : 502
      );
    }

    return jsonResponse(result.data || { success: false, message: 'پاسخ نامعتبر از سرویس رسانه دریافت شد.' }, 200);
  } catch (error) {
    console.error('Media gateway error:', safeErrorMessage(error));
    return jsonResponse({ success: false, message: 'ارتباط با سرویس کتابخانه رسانه ناموفق بود.' }, 503);
  }
};
