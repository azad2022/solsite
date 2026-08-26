type Env = { SUPABASE_URL?: string; VITE_SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string; VITE_SUPABASE_ANON_KEY?: string; SUPABASE_SERVICE_ROLE_KEY?: string; ADMIN_PASSCODE?: string };
type PagesContext = { request: Request; env: Env; params?: Record<string, string | string[] | undefined> };
type Category = { id: string; name: string; slug: string; description?: string; seo_title?: string; seo_description?: string; parent_id?: string | null; sort_order?: number; is_active?: boolean; default_media_asset_id?: string | null; default_media_url?: string | null; created_at?: string; updated_at?: string };

const fallbackUrl = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const fallbackAnon = 'sb_publishable_XaeRMCeIhR7-Zwq6YhdkVw_cOwO9OLt';
const FALLBACK_CATEGORIES: Category[] = [
  { id: 'cat-solana', name: 'آموزش سولانا', slug: 'solana', sort_order: 10, is_active: true },
  { id: 'cat-web3', name: 'توسعه وب۳', slug: 'web3-development', sort_order: 20, is_active: true },
  { id: 'cat-security', name: 'امنیت', slug: 'security', sort_order: 30, is_active: true },
  { id: 'cat-news-analysis', name: 'اخبار و تحلیل', slug: 'crypto-news-analysis', sort_order: 40, is_active: true },
  { id: 'cat-trading', name: 'ترید', slug: 'trading', sort_order: 50, is_active: true },
  { id: 'cat-prop-trading', name: 'پراپ تریدینگ', slug: 'prop-trading', sort_order: 60, is_active: true },
  { id: 'cat-meme-coin', name: 'آموزش ساخت میم کوین', slug: 'meme-coin', sort_order: 70, is_active: true },
  { id: 'cat-nft', name: 'آموزش ساخت NFT', slug: 'nft', sort_order: 80, is_active: true },
  { id: 'cat-wallet', name: 'کیف پول سولانا', slug: 'solana-wallet', sort_order: 90, is_active: true }
];

const envValue = (env: Env, key: keyof Env, fallback = '') => String(env[key] || fallback).trim();
const json = (data: unknown, status = 200, extraHeaders: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store', ...extraHeaders } });
const suppliedPasscode = (request: Request) => (request.headers.get('x-admin-passcode') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '').trim();
const supabase = (env: Env) => { const url = envValue(env, 'SUPABASE_URL', envValue(env, 'VITE_SUPABASE_URL', fallbackUrl)).replace(/\/$/, ''); const key = envValue(env, 'SUPABASE_SERVICE_ROLE_KEY', envValue(env, 'SUPABASE_ANON_KEY', envValue(env, 'VITE_SUPABASE_ANON_KEY', fallbackAnon))); return { url, key }; };
async function db(env: Env, path: string, init: RequestInit = {}) { const { url, key } = supabase(env); const headers = new Headers(init.headers); headers.set('apikey', key); headers.set('Authorization', `Bearer ${key}`); headers.set('Accept', 'application/json'); if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json'); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000); try { return await fetch(`${url}/rest/v1/${path}`, { ...init, headers, signal: controller.signal }); } finally { clearTimeout(timeout); } }
async function adminAuthorized(request: Request, env: Env): Promise<boolean> {
  try {
    const { getAuthenticatedUser } = await import('./auth/_shared');
    const user = await getAuthenticatedUser(env as any, request);
    if (user && user.is_active !== false) {
      const permissions = Array.isArray(user.permissions) ? user.permissions.map(String) : [];
      if (user.role === 'admin' || user.role === 'superadmin' || permissions.includes('articles')) return true;
    }
  } catch {
    // Fall through to the existing passcode authorization path.
  }
  const supplied = suppliedPasscode(request);
  if (!supplied) return false;
  const configured = envValue(env, 'ADMIN_PASSCODE');
  if (configured) return supplied === configured;
  if (!envValue(env, 'SUPABASE_SERVICE_ROLE_KEY')) return false;
  try {
    const response = await db(env, 'cms_settings?id=eq.main_settings&select=settings_json&limit=1');
    if (!response.ok) return false;
    const rows = await response.json().catch(() => []);
    const expected = rows?.[0]?.settings_json?.security?.adminPasscode;
    return Boolean(expected && supplied === String(expected).trim());
  } catch { return false; }
}
function cleanCategory(input: any): Category { return { id: String(input.id || `cat-${crypto.randomUUID()}`), name: String(input.name || '').trim(), slug: String(input.slug || '').trim().toLowerCase(), description: String(input.description || '').trim(), seo_title: String(input.seo_title || '').trim(), seo_description: String(input.seo_description || '').trim(), parent_id: input.parent_id ? String(input.parent_id) : null, sort_order: Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : 100, is_active: input.is_active !== false, default_media_asset_id: input.default_media_asset_id ? String(input.default_media_asset_id).trim() : null, default_media_url: input.default_media_url ? String(input.default_media_url).trim() : null }; }
function validate(category: Category) { if (!category.name || category.name.length > 120) return 'نام دسته‌بندی باید بین ۱ تا ۱۲۰ کاراکتر باشد.'; if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category.slug) || category.slug.length > 160) return 'Slug فقط باید شامل حروف انگلیسی کوچک، عدد و خط تیره باشد.'; if (category.parent_id === category.id) return 'دسته‌بندی نمی‌تواند والد خودش باشد.'; return null; }

export const onRequest = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const method = request.method.toUpperCase();
  const id = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  try {
    if (method === 'GET') {
      const includeInactive = new URL(request.url).searchParams.get('includeInactive') === 'true';
      const query = includeInactive ? 'select=*&order=sort_order.asc,name.asc' : 'select=*&is_active=eq.true&order=sort_order.asc,name.asc';
      try {
        const response = await db(env, `article_categories?${query}`);
        const data = await response.json().catch(() => []);
        if (!response.ok) return json({ success: true, categories: FALLBACK_CATEGORIES.filter(c => includeInactive || c.is_active), degraded: true, warning: 'Supabase دسته‌بندی‌ها را در دسترس قرار نداد.' }, 200, { 'X-Category-Source': 'fallback' });
        return json({ success: true, categories: Array.isArray(data) ? data : [], degraded: false }, 200, { 'X-Category-Source': 'supabase' });
      } catch {
        return json({ success: true, categories: FALLBACK_CATEGORIES.filter(c => includeInactive || c.is_active), degraded: true, warning: 'اتصال به Supabase برای دسته‌بندی‌ها برقرار نشد؛ دسته‌های پایه بارگذاری شدند.' }, 200, { 'X-Category-Source': 'fallback' });
      }
    }
    if (!(await adminAuthorized(request, env))) return json({ success: false, message: 'دسترسی مدیریت دسته‌بندی‌ها غیرمجاز است.' }, 401);
    if (method === 'POST') {
      const newCategory = cleanCategory(await request.json()); const validationError = validate(newCategory); if (validationError) return json({ success: false, message: validationError }, 400);
      const response = await db(env, 'article_categories', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...newCategory, default_media_asset_id: newCategory.default_media_asset_id || null, default_media_url: newCategory.default_media_url || null }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) return json({ success: false, message: response.status === 409 ? 'این Slug قبلاً استفاده شده است.' : 'ایجاد دسته‌بندی در Supabase ناموفق بود.', details: data }, response.status);
      return json({ success: true, category: Array.isArray(data) ? data[0] : data }, 201);
    }
    if (!id) return json({ success: false, message: 'شناسه دسته‌بندی ارسال نشده است.' }, 400);
    if (method === 'PATCH') {
      const rawPatch = await request.json().catch(() => ({}));
      const currentResponse = await db(env, `article_categories?id=eq.${encodeURIComponent(id)}&select=*`);
      const currentRows = await currentResponse.json().catch(() => []);
      if (!currentResponse.ok || !Array.isArray(currentRows) || !currentRows[0]) return json({ success: false, message: 'دسته‌بندی موردنظر پیدا نشد.' }, 404);
      const current = currentRows[0] as Category;
      const merged = { ...current, ...rawPatch, id } as Category;
      if (Object.prototype.hasOwnProperty.call(rawPatch, 'default_media_asset_id')) merged.default_media_asset_id = rawPatch.default_media_asset_id ? String(rawPatch.default_media_asset_id).trim() : null;
      if (Object.prototype.hasOwnProperty.call(rawPatch, 'default_media_url')) merged.default_media_url = rawPatch.default_media_url ? String(rawPatch.default_media_url).trim() : null;
      const patch = cleanCategory(merged);
      const validationError = validate(patch); if (validationError) return json({ success: false, message: validationError }, 400);
      const response = await db(env, `article_categories?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ name: patch.name, slug: patch.slug, description: patch.description, seo_title: patch.seo_title, seo_description: patch.seo_description, parent_id: patch.parent_id, sort_order: patch.sort_order, is_active: patch.is_active, default_media_asset_id: patch.default_media_asset_id || null, default_media_url: patch.default_media_url || null, updated_at: new Date().toISOString() }) });
      const rawResponse = await response.text();
      if (!response.ok) { let details: unknown = rawResponse; try { details = JSON.parse(rawResponse); } catch {} return json({ success: false, message: response.status === 409 ? 'این Slug قبلاً استفاده شده است.' : 'ویرایش دسته‌بندی ناموفق بود.', details }, response.status); }
      const verifyResponse = await db(env, `article_categories?id=eq.${encodeURIComponent(id)}&select=*`);
      const verifyRows = await verifyResponse.json().catch(() => []);
      const savedCategory = Array.isArray(verifyRows) ? verifyRows[0] : null;
      if (!verifyResponse.ok || !savedCategory) return json({ success: false, message: 'دسته‌بندی ذخیره شد اما تأیید نهایی آن از دیتابیس ناموفق بود.' }, 502);
      return json({ success: true, category: savedCategory });
    }
    if (method === 'DELETE') {
      const articleCheck = await db(env, `articles?category_id=eq.${encodeURIComponent(id)}&select=id&limit=1`); const linked = await articleCheck.json().catch(() => []);
      if (articleCheck.ok && Array.isArray(linked) && linked.length) return json({ success: false, message: 'این دسته‌بندی حداقل به یک مقاله متصل است. ابتدا مقالات را به دسته دیگری منتقل کنید.' }, 409);
      const childCheck = await db(env, `article_categories?parent_id=eq.${encodeURIComponent(id)}&select=id&limit=1`); const children = await childCheck.json().catch(() => []);
      if (childCheck.ok && Array.isArray(children) && children.length) return json({ success: false, message: 'این دسته‌بندی دارای زیر‌دسته است. ابتدا زیر‌دسته‌ها را منتقل یا حذف کنید.' }, 409);
      const response = await db(env, `article_categories?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) return json({ success: false, message: 'حذف دسته‌بندی در Supabase ناموفق بود.' }, response.status);
      return json({ success: true, message: 'دسته‌بندی با موفقیت حذف شد.' });
    }
    return json({ success: false, message: 'متد درخواست پشتیبانی نمی‌شود.' }, 405);
  } catch (error: any) { return json({ success: false, message: error?.message || 'خطای غیرمنتظره در سرویس دسته‌بندی‌ها.' }, 500); }
};
