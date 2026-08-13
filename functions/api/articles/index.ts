import { getAuthenticatedUser, type Env, jsonResponse } from '../auth/_shared';

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const ARTICLE_FUNCTION_URL = `${DEFAULT_URL}/functions/v1/article-publish-api`;
const SESSION_COOKIE = '__Host-solmint_session';

function db(env: Env) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Supabase server secret is not configured.');
  const base = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } };
}

function getSessionToken(request: Request): string {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function canManageArticles(user: any): boolean {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return role === 'superadmin' || role === 'admin' || permissions.includes('articles') || permissions.includes('editor');
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const actor = await getAuthenticatedUser(env, request);
    if (!canManageArticles(actor)) return jsonResponse({ success: false, code: 'ARTICLE_AUTH_REQUIRED', message: 'دسترسی مدیریت مقالات معتبر نیست.' }, 401);
    const { base, headers } = db(env);
    const response = await fetch(`${base}/rest/v1/articles?select=*&order=created_at.desc`, { headers });
    const text = await response.text();
    if (!response.ok) {
      console.error('Admin article list failed:', response.status, text.slice(0, 500));
      return jsonResponse({ success: false, code: 'ARTICLE_LIST_FAILED', message: `دریافت مقالات از Supabase ناموفق بود (HTTP ${response.status}).` }, 502);
    }
    const articles = text ? JSON.parse(text) : [];
    return jsonResponse({ success: true, articles: Array.isArray(articles) ? articles : [] });
  } catch (error) {
    console.error('Admin article list error:', error);
    return jsonResponse({ success: false, code: 'ARTICLE_LIST_SERVER_ERROR', message: 'ارتباط با دیتابیس مقالات برقرار نشد.' }, 503);
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const actor = await getAuthenticatedUser(env, request);
    if (!canManageArticles(actor)) return jsonResponse({ success: false, code: 'ARTICLE_AUTH_REQUIRED', message: 'دسترسی مدیریت مقالات معتبر نیست.' }, 401);
    const sessionToken = getSessionToken(request);
    if (!sessionToken) return jsonResponse({ success: false, code: 'SESSION_REQUIRED', message: 'نشست مدیریت معتبر نیست. لطفاً دوباره وارد شوید.' }, 401);
    const body = await request.text();
    const response = await fetch(ARTICLE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': request.headers.get('Content-Type') || 'application/json', 'x-solmint-session-token': sessionToken },
      body
    });
    const text = await response.text();
    return new Response(text, { status: response.status, headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error('Admin article save proxy failed:', error);
    return jsonResponse({ success: false, code: 'ARTICLE_SAVE_PROXY_FAILED', message: 'ارتباط با سرویس انتشار مقاله برقرار نشد.' }, 502);
  }
};
