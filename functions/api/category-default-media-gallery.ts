import { getAuthenticatedUser, type Env } from './auth/_shared';

type GalleryEnv = Env & { SUPABASE_URL?: string; SUPABASE_SECRET_KEY?: string };
const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' } });

const db = async (env: GalleryEnv, path: string, init: RequestInit = {}) => {
  const url = (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) throw new Error('SUPABASE_SECRET_KEY_NOT_CONFIGURED');
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${url}/rest/v1/${path}`, { ...init, headers });
};

const admin = async (request: Request, env: GalleryEnv) => {
  try {
    const user = await getAuthenticatedUser(env as any, request);
    return !!user && user.is_active !== false && (user.role === 'admin' || user.role === 'superadmin' || (Array.isArray(user.permissions) && user.permissions.map(String).includes('articles')));
  } catch { return false; }
};

export const onRequest = async ({ request, env }: { request: Request; env: GalleryEnv }) => {
  if (!(await admin(request, env))) return json({ success: false, message: 'دسترسی مدیریت تصاویر دسته‌بندی مجاز نیست.' }, 401);
  try {
    if (request.method === 'GET') {
      const categoriesResponse = await db(env, 'article_categories?select=id,name,default_media_asset_id,default_media_url,default_media_mode,default_media_interval_ms&order=sort_order.asc,name.asc');
      const categories = await categoriesResponse.json().catch(() => []);
      if (!categoriesResponse.ok || !Array.isArray(categories)) return json({ success: false, message: 'دریافت تنظیمات تصاویر دسته‌بندی ناموفق بود.' }, 502);
      const relationResponse = await db(env, 'category_default_media_assets?select=category_id,media_asset_id,sort_order&order=sort_order.asc,created_at.asc');
      const relations = await relationResponse.json().catch(() => []);
      if (!relationResponse.ok || !Array.isArray(relations)) return json({ success: false, message: 'دریافت مجموعه تصاویر دسته‌بندی ناموفق بود.' }, 502);
      const assetIds = Array.from(new Set(relations.map((r: any) => String(r.media_asset_id || '')).filter(Boolean)));
      const assetsResponse = assetIds.length ? await db(env, `media_assets?id=in.(${assetIds.map(encodeURIComponent).join(',')})&select=id,public_url,filename,width,height,alt_text,title`) : null;
      const assets = assetsResponse ? await assetsResponse.json().catch(() => []) : [];
      const assetMap = new Map((Array.isArray(assets) ? assets : []).map((a: any) => [String(a.id), a]));
      return json({ success: true, categories: categories.map((category: any) => ({ ...category, media_assets: relations.filter((r: any) => r.category_id === category.id).sort((a: any, b: any) => Number(a.sort_order) - Number(b.sort_order)).map((r: any) => assetMap.get(String(r.media_asset_id))).filter(Boolean) })) });
    }

    if (request.method !== 'POST') return json({ success: false, message: 'متد درخواست پشتیبانی نمی‌شود.' }, 405);
    const body = await request.json().catch(() => null) as any;
    const categoryId = String(body?.categoryId || '').trim();
    const mediaAssetIds = Array.isArray(body?.mediaAssetIds) ? body.mediaAssetIds.map(String).map((id: string) => id.trim()).filter(Boolean) : [];
    const mode = ['single', 'random', 'slideshow'].includes(body?.mode) ? body.mode : 'single';
    const intervalMs = Number(body?.intervalMs || 4500);
    if (!categoryId) return json({ success: false, message: 'شناسه دسته‌بندی ارسال نشده است.' }, 400);
    if (mediaAssetIds.length > 20) return json({ success: false, message: 'حداکثر ۲۰ تصویر برای هر دسته‌بندی مجاز است.' }, 400);
    if (!Number.isInteger(intervalMs) || intervalMs < 1500 || intervalMs > 20000) return json({ success: false, message: 'فاصله اسلاید باید بین ۱.۵ تا ۲۰ ثانیه باشد.' }, 400);

    const response = await db(env, 'rpc/set_category_default_media_gallery', {
      method: 'POST',
      body: JSON.stringify({ p_category_id: categoryId, p_media_asset_ids: mediaAssetIds, p_mode: mode, p_interval_ms: intervalMs })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return json({ success: false, message: 'ذخیره مجموعه تصاویر دسته‌بندی ناموفق بود.', details: data }, response.status >= 400 ? response.status : 502);
    const payload = Array.isArray(data) ? data[0] : data;
    return json({ success: true, ...payload });
  } catch (error: any) {
    const message = error?.message === 'SUPABASE_SECRET_KEY_NOT_CONFIGURED' ? 'کلید امن دیتابیس در محیط production تنظیم نشده است.' : (error?.message || 'خطای غیرمنتظره در سرویس تصاویر دسته‌بندی.');
    return json({ success: false, message }, 500);
  }
};
