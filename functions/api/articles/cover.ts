import { getAuthenticatedUser, type Env, jsonResponse } from '../auth/_shared';

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const SESSION_COOKIE = '__Host-solmint_session';

function getSessionToken(request: Request): string {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function db(env: Env) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVER_SECRET_MISSING');
  const base = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } };
}

function canManageMedia(user: any): boolean {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return role === 'superadmin' || role === 'admin' || permissions.includes('media');
}

function normalizePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

async function getMediaConfig(base: string, headers: Record<string, string>) {
  const response = await fetch(`${base}/rest/v1/media_config?id=eq.active_config&select=github_owner,github_repository,branch,base_path&limit=1`, { headers });
  if (!response.ok) throw new Error(`MEDIA_CONFIG_${response.status}`);
  const rows = await response.json() as any[];
  return rows[0] || { github_owner: 'azad2022', github_repository: 'solsite', branch: 'main', base_path: 'public/media/articles/' };
}

function expectedMediaUrl(config: any, path: string): string {
  const owner = String(config.github_owner || 'azad2022').trim();
  const repo = String(config.github_repository || 'solsite').trim();
  const branch = String(config.branch || 'main').trim();
  const basePath = normalizePath(String(config.base_path || 'public/media/articles/'));
  const normalized = normalizePath(path);
  if (!normalized.startsWith(`${basePath}/`) && normalized !== basePath) throw new Error('MEDIA_PATH_NOT_ALLOWED');
  return `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${normalized.split('/').map(encodeURIComponent).join('/')}`;
}

export const onRequestOptions = async () => new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const actor = await getAuthenticatedUser(env, request);
    if (!canManageMedia(actor)) return jsonResponse({ success: false, code: 'MEDIA_AUTH_REQUIRED', message: 'مجوز مدیریت کتابخانه رسانه معتبر نیست.' }, 403);
    if (!getSessionToken(request)) return jsonResponse({ success: false, code: 'SESSION_REQUIRED', message: 'نشست مدیریت معتبر نیست.' }, 401);

    const body = await request.json().catch(() => null) as any;
    const articleIds = Array.isArray(body?.articleIds) ? body.articleIds.map((x: unknown) => String(x).trim()).filter(Boolean) : [];
    const asset = body?.asset && typeof body.asset === 'object' ? body.asset : null;
    if (!articleIds.length || !asset?.path || !asset?.publicUrl) return jsonResponse({ success: false, code: 'COVER_ASSIGN_INPUT_INVALID', message: 'مقاله یا تصویر انتخاب نشده است.' }, 400);
    if (articleIds.length > 100) return jsonResponse({ success: false, code: 'COVER_ASSIGN_BATCH_LIMIT', message: 'در هر عملیات حداکثر ۱۰۰ مقاله قابل به‌روزرسانی است.' }, 400);

    const { base, headers } = db(env);
    const config = await getMediaConfig(base, headers);
    const canonicalUrl = expectedMediaUrl(config, String(asset.path));
    if (canonicalUrl !== String(asset.publicUrl)) return jsonResponse({ success: false, code: 'COVER_ASSET_NOT_TRUSTED', message: 'تصویر انتخاب‌شده متعلق به کتابخانه رسانه فعال نیست.' }, 400);

    const idList = articleIds.map(id => `id.eq.${encodeURIComponent(id)}`).join(',');
    const articlesResponse = await fetch(`${base}/rest/v1/articles?select=id,cover_image&id=in.(${articleIds.map(encodeURIComponent).join(',')})`, { headers });
    if (!articlesResponse.ok) return jsonResponse({ success: false, code: 'ARTICLE_LOOKUP_FAILED', message: `خواندن مقالات از Supabase ناموفق بود (HTTP ${articlesResponse.status}).` }, 502);
    const rows = await articlesResponse.json() as any[];

    const results: Array<{ id: string; success: boolean; skipped?: boolean; message?: string }> = [];
    for (const id of articleIds) {
      const row = rows.find((x: any) => String(x.id) === id);
      if (!row) { results.push({ id, success: false, message: 'مقاله یافت نشد.' }); continue; }
      const current = String(row.cover_image || '').trim();
      if (current) { results.push({ id, success: true, skipped: true, message: 'مقاله از قبل تصویر دارد.' }); continue; }
      const response = await fetch(`${base}/rest/v1/articles?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ cover_image: canonicalUrl, updated_at: new Date().toISOString() })
      });
      if (!response.ok) { results.push({ id, success: false, message: `به‌روزرسانی ناموفق بود (HTTP ${response.status}).` }); continue; }
      results.push({ id, success: true, message: 'تصویر اعمال شد.' });
    }

    const applied = results.filter(x => x.success && !x.skipped).length;
    const skipped = results.filter(x => x.skipped).length;
    const failed = results.filter(x => !x.success).length;
    return jsonResponse({ success: failed === 0, code: failed ? 'COVER_ASSIGN_PARTIAL_FAILURE' : 'COVER_ASSIGN_SUCCESS', message: `تصویر روی ${applied} مقاله اعمال شد؛ ${skipped} مقاله از قبل تصویر داشت${failed ? ` و ${failed} مورد ناموفق بود` : ''}.`, applied, skipped, failed, results, asset: { path: asset.path, publicUrl: canonicalUrl } });
  } catch (error) {
    console.error('Article cover assignment failed:', error);
    return jsonResponse({ success: false, code: 'COVER_ASSIGN_SERVER_ERROR', message: 'اعمال تصویر کاور در دیتابیس ناموفق بود.' }, 503);
  }
};
