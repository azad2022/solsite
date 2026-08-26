import { getAuthenticatedUser, jsonResponse, type Env } from './auth/_shared';

type CategoryDefaultEnv = Env & { SUPABASE_URL?: string };
const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

export const onRequest = async ({ request, env }: { request: Request; env: CategoryDefaultEnv }) => {
  if (request.method !== 'POST') return jsonResponse({ success: false, message: 'Method Not Allowed' }, 405, { Allow: 'POST' });

  const user = await getAuthenticatedUser(env, request);
  if (!user || user.is_active === false || !['admin', 'superadmin'].includes(String(user.role))) {
    return jsonResponse({ success: false, message: 'دسترسی مدیریت تصویر پیش‌فرض مجاز نیست.' }, 401);
  }

  const body = await request.json().catch(() => null) as any;
  const assignments = Array.isArray(body?.assignments) ? body.assignments : [];
  const assetId = String(body?.assetId || '').trim();
  const publicUrl = String(body?.publicUrl || '').trim();

  if (!assignments.length || assignments.length > 100) return jsonResponse({ success: false, message: 'لیست دسته‌بندی‌ها نامعتبر است.' }, 400);
  if (!assetId || !/^https:\/\//i.test(publicUrl)) return jsonResponse({ success: false, message: 'شناسه یا URL تصویر نامعتبر است.' }, 400);

  const assignIds = assignments.filter((x: any) => x?.use === true).map((x: any) => String(x.id || '').trim()).filter(Boolean);
  const clearIds = assignments.filter((x: any) => x?.use === false).map((x: any) => String(x.id || '').trim()).filter(Boolean);

  const supabaseUrl = (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!key) return jsonResponse({ success: false, message: 'کلید سرویس دیتابیس در production تنظیم نشده است.' }, 503);

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/set_category_default_media`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_assign_category_ids: assignIds, p_clear_category_ids: clearIds, p_asset_id: assetId, p_url: publicUrl })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) return jsonResponse({ success: false, message: 'ذخیره تصویر پیش‌فرض دسته‌بندی‌ها ناموفق بود.', details: data }, 502);

  const rows = Array.isArray(data) ? data : [];
  const assigned = rows.filter((row: any) => row.action === 'assigned');
  const cleared = rows.filter((row: any) => row.action === 'cleared');
  const articlesUpdated = assigned.reduce((sum: number, row: any) => sum + Number(row.articles_updated || 0), 0);

  return jsonResponse({
    success: true,
    categoriesUpdated: assigned.length,
    categoriesCleared: cleared.length,
    articlesUpdated,
    assignments: rows
  });
};
