import { getBetterAuthApplicationUser, getBetterAuthSessionToken } from '../auth/_application-session';
import { jsonResponse, type Env } from '../auth/_shared';

type MediaEnv = Env & {
  SUPABASE_URL?: string;
  NODE_ENV?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  BETTER_AUTH_DATABASE_URL?: string;
  HYPERDRIVE?: { connectionString: string };
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
};

const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const ALLOWED_ACTIONS = new Set(['config', 'assets', 'test-connection', 'upload', 'delete', 'migrate']);

function getSupabaseUrl(env: MediaEnv) { return (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, ''); }
function actionFor(action: string) { switch (action) { case 'config': return 'get-config'; case 'assets': return 'list'; case 'test-connection': return 'test'; default: return action; } }
function canManageMedia(user: Awaited<ReturnType<typeof getBetterAuthApplicationUser>>) {
  return !!user && ['admin', 'superadmin'].includes(String(user.role).toLowerCase()) && user.isActive;
}

export const onRequest = async ({ request, env, params }: { request: Request; env: MediaEnv; params: Record<string, string> }) => {
  const action = String(params?.action || '').trim();
  if (!ALLOWED_ACTIONS.has(action)) return jsonResponse({ success: false, errorCode: 'INVALID_MEDIA_ACTION', message: 'عملیات رسانه نامعتبر است.' }, 404);
  if (request.method !== 'GET' && request.method !== 'POST') return jsonResponse({ success: false, errorCode: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' }, 405, { Allow: 'GET, POST' });

  let user;
  try { user = await getBetterAuthApplicationUser(request, env); }
  catch (error) {
    console.error('Media Better Auth validation failed:', error instanceof Error ? error.message : String(error));
    return jsonResponse({ success: false, errorCode: 'MEDIA_ADMIN_AUTH_VALIDATION_ERROR', message: 'اعتبارسنجی نشست مدیر در سرور ناموفق بود.' }, 503);
  }
  if (!user) return jsonResponse({ success: false, errorCode: 'MEDIA_ADMIN_AUTH_REQUIRED', message: 'نشست Better Auth مدیر معتبر نیست.' }, 401);
  if (!canManageMedia(user)) return jsonResponse({ success: false, errorCode: 'MEDIA_ADMIN_ROLE_DENIED', message: 'این حساب مجوز مدیریت کتابخانه تصاویر را ندارد.' }, 403);

  const sessionToken = getBetterAuthSessionToken(request);
  if (!sessionToken) return jsonResponse({ success: false, errorCode: 'BETTER_AUTH_SESSION_REQUIRED', message: 'نشست Better Auth در درخواست موجود نیست.' }, 401);

  const upstreamBody = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  const payload = { ...(upstreamBody && typeof upstreamBody === 'object' ? upstreamBody : {}), action: actionFor(action) };

  try {
    // The Edge Function must validate this Better Auth session server-to-server.
    // Legacy x-solmint-session is deliberately not accepted or emitted here.
    const upstream = await fetch(`${getSupabaseUrl(env)}/functions/v1/github-media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-solmint-better-auth-session': sessionToken,
        'x-solmint-auth-source': 'better-auth',
        'x-media-gateway-version': '5',
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!upstream.ok) {
      console.error('Media upstream failure', { action, upstreamStatus: upstream.status, errorCode: data?.errorCode || null, stage: data?.stage || null });
      return jsonResponse(data || { success: false, errorCode: 'MEDIA_UPSTREAM_HTTP_ERROR', message: `سرویس کتابخانه تصاویر پاسخ HTTP ${upstream.status} داد.` }, upstream.status >= 500 ? 503 : upstream.status);
    }
    return jsonResponse(data || { success: true }, 200);
  } catch (error) {
    console.error('Media gateway network error', { action, error: error instanceof Error ? error.message : String(error) });
    return jsonResponse({ success: false, errorCode: 'MEDIA_UPSTREAM_UNREACHABLE', stage: 'supabase_edge_function', message: 'اتصال server-to-server به سرویس کتابخانه تصاویر برقرار نشد.' }, 503);
  }
};
