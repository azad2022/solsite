type Env = {
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ADMIN_PASSCODE?: string;
};

type PagesContext = { request: Request; env: Env; params?: Record<string, string | string[] | undefined> };
type Category = { id: string; name: string; slug: string; description?: string; seo_title?: string; seo_description?: string; parent_id?: string | null; sort_order?: number; is_active?: boolean; created_at?: string; updated_at?: string };

const fallbackUrl = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const fallbackAnon = 'sb_publishable_XaeRMCeIhR7-Zwq6YhdkVw_cOwO9OLt';
const envValue = (env: Env, key: keyof Env, fallback = '') => String(env[key] || fallback).trim();
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' } });
const adminAuthorized = (request: Request, env: Env) => { const expected = envValue(env, 'ADMIN_PASSCODE'); const supplied = (request.headers.get('x-admin-passcode') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '').trim(); return Boolean(expected && supplied && supplied === expected); };
const supabase = (env: Env) => { const url = envValue(env, 'SUPABASE_URL', envValue(env, 'VITE_SUPABASE_URL', fallbackUrl)).replace(/\/$/, ''); const key = envValue(env, 'SUPABASE_SERVICE_ROLE_KEY', envValue(env, 'SUPABASE_ANON_KEY', envValue(env, 'VITE_SUPABASE_ANON_KEY', fallbackAnon))); return { url, key }; };
async function db(env: Env, path: string, init: RequestInit = {}) { const { url, key } = supabase(env); const headers = new Headers(init.headers); headers.set('apikey', key); headers.set('Authorization', `Bearer ${key}`); headers.set('Accept', 'application/json'); if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json'); return fetch(`${url}/rest/v1/${path}`, { ...init, headers }); }
function cleanCategory(input: any): Category { return { id: String(input.id || `cat-${crypto.randomUUID()}`), name: String(input.name || '').trim(), slug: String(input.slug || '').trim().toLowerCase(), description: String(input.description || '').trim(), seo_title: String(input.seo_title || '').trim(), seo_description: String(input.seo_description || '').trim(), parent_id: input.parent_id ? String(input.parent_id) : null, sort_order: Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : 100, is_active: input.is_active !== false }; }
function validate(category: Category) { if (!category.name || category.name.length > 120) return 'نام دسته‌بندی باید بین ۱ تا ۱۲۰ کاراکتر باشد.'; if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category.slug) || category.slug.length > 160) return 'Slug فقط باید شامل حروف انگلیسی کوچک، عدد و خط تیره باشد.'; if (category.parent_id === category.id) return 'دسته‌بندی نمی‌تواند والد خودش باشد.'; return null; }

export const onRequest = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const method = request.method.toUpperCase();
  const id = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  try {
    if (method === 'GET') {
      const includeInactive = new URL(request.url).searchParams.get('includeInactive') === 'true';
      const query = includeInactive ? 'select=*&order=sort_order.asc,name.asc' : 'select=*&is_active=eq.true&order=sort_order.asc,name.asc';
      const response = await db(env, `article_categories?${query}`); const data = await response.json().catch(() => []);
      if (!response.ok) return json({ success: false, message: 'دریافت دسته‌بندی‌ها از Supabase ناموفق بود.', details: data }, response.status);
      return json({ success: true, categories: data });
    }
    if (!adminAuthorized(request, env)) return json({ success: false, message: 'دسترسی مدیریت دسته‌بندی‌ها غیرمجاز است.' }, 401);
    if (method === 'POST') {
      const category = cleanCategory(await request.json()); const error = validate(category); if (error) return json({ success: false, message: error }, 400);
      const response = await db(env, 'article_categories', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(category) }); const data = await response.json().catch(() => null);
      if (!response.ok) return json({ success: false, message: response.status === 409 ? 'این Slug قبلاً استفاده شده است.' : 'ایجاد دسته‌بندی در Supabase ناموفق بود.', details: data }, response.status);
      return json({ success: true, category: Array.isArray(data) ? data[0] : data }, 201);
    }
    if (!id) return json({ success: false, message: 'شناسه دسته‌بندی ارسال نشده است.' }, 400);
    if (method === 'PATCH') {
      const patch = cleanCategory({ ...(await request.json()), id }); const error = validate(patch); if (error) return json({ success: false, message: error }, 400);
      const response = await db(env, `article_categories?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ name: patch.name, slug: patch.slug, description: patch.description, seo_title: patch.seo_title, seo_description: patch.seo_description, parent_id: patch.parent_id, sort_order: patch.sort_order, is_active: patch.is_active, updated_at: new Date().toISOString() }) }); const data = await response.json().catch(() => null);
      if (!response.ok) return json({ success: false, message: response.status === 409 ? 'این Slug قبلاً استفاده شده است.' : 'ویرایش دسته‌بندی ناموفق بود.', details: data }, response.status);
      return json({ success: true, category: Array.isArray(data) ? data[0] : data });
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
