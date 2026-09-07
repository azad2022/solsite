import { getBetterAuthApplicationUser, getBetterAuthSessionToken } from '../auth/_application-session';
import type { Env } from '../auth/_shared';
import { jsonResponse } from '../auth/_shared';

const ARTICLE_FUNCTION_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co/functions/v1/article-publish-api';

function canManageArticles(user: Awaited<ReturnType<typeof getBetterAuthApplicationUser>>): boolean {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  const permissions = Array.isArray(user.permissions) ? user.permissions.map(String) : [];
  return role === 'superadmin' || role === 'admin' || permissions.includes('articles') || permissions.includes('editor');
}
function json(body: unknown, status = 200) {
  return jsonResponse(body, status, { 'Cache-Control': 'no-store, no-cache, must-revalidate' });
}

export const onRequestOptions = async () => new Response(null, {
  status: 204,
  headers: {
    'Access-Control-Allow-Origin': 'same-origin',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600'
  }
});

export const onRequestDelete = async ({ request, env, params }: { request: Request; env: Env; params: { id?: string } }) => {
  const actor = await getBetterAuthApplicationUser(request, env);
  if (!actor) return json({ success: false, code: 'ARTICLE_AUTH_REQUIRED', message: 'نشست مدیریت مقاله معتبر نیست.' }, 401);
  if (!canManageArticles(actor)) return json({ success: false, code: 'ARTICLE_FORBIDDEN', message: 'این حساب مجوز حذف مقاله را ندارد.' }, 403);

  const sessionToken = getBetterAuthSessionToken(request);
  if (!sessionToken) return json({ success: false, code: 'BETTER_AUTH_SESSION_REQUIRED', message: 'نشست Better Auth در درخواست موجود نیست.' }, 401);
  const id = String(params?.id || '').trim();
  if (!id) return json({ success: false, code: 'ARTICLE_ID_MISSING', message: 'شناسه مقاله مشخص نشده است.' }, 400);

  try {
    const response = await fetch(`${ARTICLE_FUNCTION_URL}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'x-solmint-better-auth-session': sessionToken,
        'x-solmint-auth-source': 'better-auth'
      }
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
    console.error('Article delete proxy failed:', error instanceof Error ? error.message : String(error));
    return json({ success: false, code: 'ARTICLE_DELETE_PROXY_FAILED', message: 'ارتباط با سرویس حذف مقاله برقرار نشد.' }, 502);
  }
};
