import { getBetterAuthApplicationUser, getBetterAuthSessionToken } from '../auth/_application-session';
import { jsonResponse, type Env } from '../auth/_shared';

const ARTICLE_FUNCTION_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co/functions/v1/article-publish-api';
type PublishEnv = Env & {
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

function canManageArticles(user: Awaited<ReturnType<typeof getBetterAuthApplicationUser>>) {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  const permissions = Array.isArray(user.permissions) ? user.permissions.map(String) : [];
  return role === 'admin' || role === 'superadmin' || permissions.includes('articles') || permissions.includes('editor');
}

export const onRequestOptions = async () => new Response(null, {
  status: 204,
  headers: {
    'Access-Control-Allow-Origin': 'same-origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600'
  }
});

export const onRequestPost = async ({ request, env }: { request: Request; env: PublishEnv }) => {
  const actor = await getBetterAuthApplicationUser(request, env);
  if (!actor) return jsonResponse({ success: false, code: 'ARTICLE_AUTH_REQUIRED', message: 'نشست مدیریت مقاله معتبر نیست.' }, 401);
  if (!canManageArticles(actor)) return jsonResponse({ success: false, code: 'ARTICLE_FORBIDDEN', message: 'این حساب مجوز انتشار مقاله را ندارد.' }, 403);

  const sessionToken = getBetterAuthSessionToken(request);
  if (!sessionToken) return jsonResponse({ success: false, code: 'BETTER_AUTH_SESSION_REQUIRED', message: 'نشست Better Auth در درخواست موجود نیست.' }, 401);
  try {
    const body = await request.text();
    const response = await fetch(ARTICLE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('Content-Type') || 'application/json',
        'x-solmint-better-auth-session': sessionToken,
        'x-solmint-auth-source': 'better-auth'
      },
      body
    });
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (error) {
    console.error('Article publish proxy failed:', error instanceof Error ? error.message : String(error));
    return jsonResponse({ success: false, code: 'ARTICLE_PUBLISH_PROXY_FAILED', message: 'ارتباط با سرویس انتشار مقاله برقرار نشد.' }, 502);
  }
};
