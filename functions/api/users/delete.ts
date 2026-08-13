import { getAuthenticatedUser, type Env, jsonResponse } from '../auth/_shared';

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

function db(env: Env) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Supabase server secret is not configured.');
  return {
    base: (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, ''),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  };
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const actor = await getAuthenticatedUser(env, request);
    const actorRole = String(actor?.role || '').toLowerCase();
    if (!actor || !['superadmin', 'admin'].includes(actorRole)) {
      return jsonResponse({ success: false, code: 'ADMIN_AUTH_REQUIRED', message: 'دسترسی مدیر معتبر نیست.' }, 401);
    }

    const body = await request.json().catch(() => null) as { userId?: unknown } | null;
    const userId = String(body?.userId || '').trim();
    if (!userId) return jsonResponse({ success: false, code: 'USER_ID_REQUIRED', message: 'شناسه کاربر الزامی است.' }, 400);
    if (userId === actor.id) {
      return jsonResponse({ success: false, code: 'SELF_DELETE_FORBIDDEN', message: 'حذف حساب کاربری خودتان مجاز نیست.' }, 400);
    }

    const { base, headers } = db(env);
    const targetResponse = await fetch(`${base}/rest/v1/users?select=id,username,role,is_active&id=eq.${encodeURIComponent(userId)}&limit=1`, { headers });
    const targetText = await targetResponse.text();
    if (!targetResponse.ok) {
      console.error('Admin delete target lookup failed:', targetResponse.status, targetText.slice(0, 500));
      return jsonResponse({ success: false, code: 'USER_LOOKUP_FAILED', message: 'بررسی حساب کاربر در Supabase ناموفق بود.' }, 502);
    }

    const targets = targetText ? JSON.parse(targetText) as Array<{ id: string; username: string; role: string; is_active: boolean }> : [];
    const target = targets[0];
    if (!target) return jsonResponse({ success: false, code: 'USER_NOT_FOUND', message: 'کاربر پیدا نشد.' }, 404);

    const targetRole = String(target.role || '').toLowerCase();
    if (targetRole === 'superadmin' && actorRole !== 'superadmin') {
      return jsonResponse({ success: false, code: 'SUPERADMIN_DELETE_FORBIDDEN', message: 'حذف حساب superadmin فقط توسط superadmin مجاز است.' }, 403);
    }

    // Superadmin may delete normal admins/users. Admin may not delete a superadmin.
    if (actorRole !== 'superadmin' && targetRole === 'admin') {
      return jsonResponse({ success: false, code: 'ADMIN_DELETE_FORBIDDEN', message: 'admin معمولی اجازه حذف حساب admin دیگر را ندارد.' }, 403);
    }

    const response = await fetch(`${base}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { ...headers, Prefer: 'return=representation' }
    });
    const text = await response.text();
    if (!response.ok) {
      console.error('User deletion failed:', response.status, text.slice(0, 500));
      return jsonResponse({ success: false, code: 'USER_DELETE_FAILED', message: `حذف کاربر از Supabase ناموفق بود (HTTP ${response.status}).` }, 502);
    }

    const deletedRows = text ? JSON.parse(text) : [];
    if (!Array.isArray(deletedRows) || deletedRows.length !== 1) {
      return jsonResponse({ success: false, code: 'USER_DELETE_NOT_CONFIRMED', message: 'Supabase حذف کاربر را تأیید نکرد.' }, 409);
    }

    // auth_sessions.user_id has ON DELETE CASCADE in the production schema;
    // the explicit cleanup below is only a defensive fallback for older schemas.
    await fetch(`${base}/rest/v1/auth_sessions?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers
    }).catch(() => {});

    return jsonResponse({ success: true, code: 'USER_DELETED', message: 'کاربر با موفقیت حذف شد.', deletedUser: { id: target.id, username: target.username, role: target.role } });
  } catch (error) {
    console.error('Admin user deletion failed:', error);
    return jsonResponse({ success: false, code: 'USER_DELETE_SERVER_ERROR', message: 'ارتباط با دیتابیس کاربران برقرار نشد.' }, 503);
  }
};
