import { getAuthenticatedUser, type Env, jsonResponse } from '../auth/_shared';

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
function db(env: Env) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Supabase server secret is not configured.');
  return { base: (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, ''), headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } };
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const actor = await getAuthenticatedUser(env, request);
    if (!actor || !['superadmin', 'admin'].includes(String(actor.role))) return jsonResponse({ success: false, message: 'دسترسی مدیر معتبر نیست.' }, 401);
    const body = await request.json() as { userId?: unknown };
    const userId = String(body.userId || '').trim();
    if (!userId) return jsonResponse({ success: false, message: 'شناسه کاربر الزامی است.' }, 400);
    if (userId === actor.id) return jsonResponse({ success: false, message: 'حذف حساب کاربری خودتان مجاز نیست.' }, 400);

    const { base, headers } = db(env);
    const targetResponse = await fetch(`${base}/rest/v1/users?select=id,role&id=eq.${encodeURIComponent(userId)}&limit=1`, { headers });
    if (!targetResponse.ok) throw new Error(`Target lookup failed: ${targetResponse.status}`);
    const targets = await targetResponse.json() as Array<{ id: string; role: string }>;
    const target = targets[0];
    if (!target) return jsonResponse({ success: false, message: 'کاربر پیدا نشد.' }, 404);
    if (target.role === 'superadmin' && actor.role !== 'superadmin') return jsonResponse({ success: false, message: 'حذف حساب superadmin فقط توسط superadmin مجاز است.' }, 403);

    const response = await fetch(`${base}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } });
    if (!response.ok) throw new Error(`User deletion failed: ${response.status}`);
    await fetch(`${base}/rest/v1/auth_sessions?user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE', headers }).catch(() => {});
    return jsonResponse({ success: true, message: 'کاربر با موفقیت حذف شد.' });
  } catch (error) {
    console.error('Admin user deletion failed:', error);
    return jsonResponse({ success: false, message: 'حذف کاربر انجام نشد.' }, 503);
  }
};
