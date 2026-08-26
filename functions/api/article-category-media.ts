type Env = { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string; VITE_SUPABASE_ANON_KEY?: string; SUPABASE_SERVICE_ROLE_KEY?: string };
const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=600' } });

export const onRequest = async ({ request, env }: { request: Request; env: Env }) => {
  if (request.method !== 'GET') return json({ success: false, message: 'متد درخواست پشتیبانی نمی‌شود.' }, 405);
  const params = new URL(request.url).searchParams;
  const requestedId = params.get('categoryId')?.trim() || '';
  const requestedName = params.get('categoryName')?.trim() || '';
  if (!requestedId && !requestedName) return json({ success: false, message: 'شناسه یا نام دسته‌بندی ارسال نشده است.' }, 400);
  const base = (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) return json({ success: false, message: 'اتصال به دیتابیس برای تصاویر دسته‌بندی تنظیم نشده است.' }, 503);
  try {
    const filter = requestedId ? `id=eq.${encodeURIComponent(requestedId)}` : `name=eq.${encodeURIComponent(requestedName)}`;
    const categoryResponse = await fetch(`${base}/rest/v1/article_categories?${filter}&select=id,name,default_media_asset_id,default_media_url,default_media_mode,default_media_interval_ms&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } });
    const categories = await categoryResponse.json().catch(() => []);
    if (!categoryResponse.ok || !Array.isArray(categories) || !categories[0]) return json({ success: false, message: 'دسته‌بندی پیدا نشد.' }, 404);
    const categoryId = String(categories[0].id);
    const relationResponse = await fetch(`${base}/rest/v1/category_default_media_assets?category_id=eq.${encodeURIComponent(categoryId)}&select=media_asset_id,sort_order&order=sort_order.asc,created_at.asc`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } });
    const relations = await relationResponse.json().catch(() => []);
    if (!relationResponse.ok || !Array.isArray(relations)) return json({ success: false, message: 'مجموعه تصاویر دسته‌بندی در دسترس نیست.' }, 502);
    const ids = Array.from(new Set(relations.map((row: any) => String(row.media_asset_id || '')).filter(Boolean)));
    const assetsResponse = ids.length ? await fetch(`${base}/rest/v1/media_assets?id=in.(${ids.map(encodeURIComponent).join(',')})&select=id,public_url,filename,width,height,alt_text,title`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } }) : null;
    const assets = assetsResponse ? await assetsResponse.json().catch(() => []) : [];
    const assetMap = new Map((Array.isArray(assets) ? assets : []).map((asset: any) => [String(asset.id), asset]));
    const orderedAssets = relations.map((row: any) => assetMap.get(String(row.media_asset_id))).filter(Boolean);
    const category = categories[0];
    return json({ success: true, category: { id: category.id, name: category.name, mode: category.default_media_mode || 'single', intervalMs: category.default_media_interval_ms || 4500 }, assets: orderedAssets });
  } catch (error: any) {
    return json({ success: false, message: error?.message || 'خطای غیرمنتظره در دریافت تصاویر دسته‌بندی.' }, 500);
  }
};
