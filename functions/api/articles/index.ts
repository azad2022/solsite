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

function normalizeArticle(item: any) {
  const tags = Array.isArray(item?.tags) ? item.tags : (typeof item?.tags === 'string' ? (() => { try { const parsed = JSON.parse(item.tags); return Array.isArray(parsed) ? parsed : item.tags.split(',').map((x: string) => x.trim()).filter(Boolean); } catch { return item.tags.split(',').map((x: string) => x.trim()).filter(Boolean); } })() : []);
  const comments = Array.isArray(item?.comments) ? item.comments : [];
  const author = item?.author && typeof item.author === 'object' ? item.author : { name: 'تیم سولمینت', role: 'مدیریت', avatar: '⚡' };
  return {
    id: item?.id,
    title: String(item?.title || ''),
    slug: String(item?.slug || ''),
    category: item?.category || 'آموزش سولانا',
    tags,
    summary: String(item?.summary || ''),
    content: String(item?.content || ''),
    coverImage: item?.coverImage || item?.cover_image || '/images/blog-og.jpg',
    coverImageAssetId: item?.coverImageAssetId || item?.cover_image_asset_id || '',
    videoUrl: item?.videoUrl || item?.video_url || undefined,
    author,
    publishedAt: item?.publishedAt || item?.published_at || item?.created_at || new Date().toISOString(),
    publishedAtJalali: item?.publishedAtJalali || item?.published_at_jalali || '',
    publishedAtGregorian: item?.publishedAtGregorian || item?.published_at_gregorian || '',
    readTimeMinutes: Number(item?.readTimeMinutes ?? item?.read_time_minutes ?? 5),
    viewsCount: Number(item?.viewsCount ?? item?.views_count ?? 0),
    comments,
    seoScore: Number(item?.seoScore ?? item?.seo_score ?? 90),
    isDraft: Boolean(item?.isDraft ?? item?.is_draft)
  };
}

function normalizeArticles(items: unknown) { return Array.isArray(items) ? items.map(normalizeArticle).filter((item: any) => item.id && item.slug) : []; }

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const { base, headers } = db(env);
    const actor = await getAuthenticatedUser(env, request);
    if (canManageArticles(actor)) {
      const response = await fetch(`${base}/rest/v1/articles?select=*&order=created_at.desc`, { headers });
      const text = await response.text();
      if (!response.ok) { console.error('Admin article list failed:', response.status, text.slice(0, 500)); return jsonResponse({ success: false, code: 'ARTICLE_LIST_FAILED', message: `دریافت مقالات از Supabase ناموفق بود (HTTP ${response.status}).` }, 502); }
      return jsonResponse({ success: true, articles: normalizeArticles(text ? JSON.parse(text) : []) });
    }
    const publicSelect = ['id','title','slug','category','tags','summary','cover_image','cover_image_asset_id','video_url','author','published_at','published_at_jalali','published_at_gregorian','read_time_minutes','views_count','seo_score','is_draft','created_at'].join(',');
    const response = await fetch(`${base}/rest/v1/articles?select=${encodeURIComponent(publicSelect)}&is_draft=eq.false&order=created_at.desc&limit=50`, { headers });
    const text = await response.text();
    if (!response.ok) { console.error('Public article list failed:', response.status, text.slice(0, 500)); return jsonResponse({ success: false, code: 'PUBLIC_ARTICLE_LIST_FAILED', message: 'دریافت فهرست مقالات ناموفق بود.' }, 502); }
    return jsonResponse({ success: true, articles: normalizeArticles(text ? JSON.parse(text) : []) });
  } catch (error) {
    console.error('Article list error:', error);
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
    const response = await fetch(ARTICLE_FUNCTION_URL, { method: 'POST', headers: { 'Content-Type': request.headers.get('Content-Type') || 'application/json', 'x-solmint-session-token': sessionToken }, body });
    const text = await response.text();
    return new Response(text, { status: response.status, headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error('Admin article save proxy failed:', error);
    return jsonResponse({ success: false, code: 'ARTICLE_SAVE_PROXY_FAILED', message: 'ارتباط با سرویس انتشار مقاله برقرار نشد.' }, 502);
  }
};
