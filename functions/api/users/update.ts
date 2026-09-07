import { getBetterAuthApplicationUser } from '../auth/_application-session';
import { jsonResponse, type Env } from '../auth/_shared';

interface UpdateEnv extends Env { SUPABASE_SERVICE_ROLE_KEY?: string; }
const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
function db(env: UpdateEnv) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('Supabase server secret is not configured.');
  return { base: (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, ''), key };
}

export const onRequestPost = async ({ request, env }: { request: Request; env: UpdateEnv }) => {
  try {
    const actor = await getBetterAuthApplicationUser(request, env);
    if (!actor || !['superadmin', 'admin'].includes(String(actor.role).toLowerCase()) || !actor.isActive) {
      return jsonResponse({ success: false, message: 'احراز هویت مدیر نامعتبر است.' }, 401);
    }

    const body = await request.json() as {
      userId?: unknown;
      role?: unknown;
      permissions?: unknown;
      isActive?: unknown;
      password?: unknown;
      passwordHash?: unknown;
    };
    const userId = String(body.userId || '').trim();
    if (!userId) return jsonResponse({ success: false, message: 'شناسه کاربر الزامی است.' }, 400);

    // public.users.password_hash is legacy data and is not an authoritative Better Auth credential.
    // Do not silently mutate it through an endpoint that callers may assume changes the login password.
    if (body.password !== undefined || body.passwordHash !== undefined) {
      return jsonResponse({
        success: false,
        code: 'BETTER_AUTH_PASSWORD_ADMIN_API_REQUIRED',
        message: 'تغییر رمز عبور کاربران باید از مسیر مدیریتی Better Auth انجام شود؛ تغییر password_hash قدیمی مجاز نیست.'
      }, 409);
    }

    const { base, key } = db(env);
    const authHeaders = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    const targetResponse = await fetch(`${base}/rest/v1/users?select=id,username,role,is_active&id=eq.${encodeURIComponent(userId)}&limit=1`, { headers: authHeaders });
    if (!targetResponse.ok) throw new Error(`Target lookup failed: ${targetResponse.status}`);
    const targets = await targetResponse.json() as Array<{ id: string; username: string; role: string; is_active: boolean }>;
    const target = targets[0];
    if (!target) return jsonResponse({ success: false, message: 'کاربر پیدا نشد.' }, 404);

    const actorIsSuperadmin = String(actor.role).toLowerCase() === 'superadmin';
    const targetIsSuperadmin = String(target.role).toLowerCase() === 'superadmin';
    if (!actorIsSuperadmin && targetIsSuperadmin) return jsonResponse({ success: false, message: 'تغییر حساب superadmin فقط توسط superadmin مجاز است.' }, 403);
    if (userId === actor.applicationUserId && (body.role !== undefined || body.isActive === false)) return jsonResponse({ success: false, message: 'تغییر نقش یا غیرفعال‌سازی حساب جاری مجاز نیست.' }, 400);

    const requestedRole = typeof body.role === 'string' ? body.role.trim().toLowerCase() : undefined;
    const allowedRoles = new Set(['user', 'admin', 'superadmin']);
    if (requestedRole !== undefined) {
      if (!allowedRoles.has(requestedRole)) return jsonResponse({ success: false, message: 'نقش کاربر نامعتبر است.' }, 400);
      if (!actorIsSuperadmin && requestedRole === 'superadmin') return jsonResponse({ success: false, message: 'admin اجازه ایجاد یا ارتقای superadmin را ندارد.' }, 403);
    }

    const patch: Record<string, unknown> = {};
    if (requestedRole !== undefined) patch.role = requestedRole;
    if (Array.isArray(body.permissions)) patch.permissions = body.permissions.filter((p): p is string => typeof p === 'string').map(p => p.trim()).filter(Boolean).slice(0, 50);
    if (typeof body.isActive === 'boolean') patch.is_active = body.isActive;
    if (Object.keys(patch).length === 0) return jsonResponse({ success: false, message: 'هیچ تغییری برای ذخیره وجود ندارد.' }, 400);

    const response = await fetch(`${base}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { ...authHeaders, Prefer: 'return=representation' },
      body: JSON.stringify(patch)
    });
    const text = await response.text();
    if (!response.ok) {
      console.error('User update error:', response.status, text.slice(0, 500));
      return jsonResponse({ success: false, message: 'ذخیره تغییرات کاربر در Supabase انجام نشد.' }, 500);
    }
    const rows = text ? JSON.parse(text) : [];
    const updated = Array.isArray(rows) ? rows[0] : null;
    return jsonResponse({
      success: true,
      message: 'تغییرات کاربر در Supabase ذخیره شد.',
      user: updated ? {
        id: updated.id,
        username: updated.username,
        fullName: updated.full_name,
        role: updated.role,
        permissions: Array.isArray(updated.permissions) ? updated.permissions : [],
        isActive: updated.is_active,
        createdAt: updated.created_at
      } : undefined
    });
  } catch (error) {
    console.error('Production user update error:', error instanceof Error ? error.message : String(error));
    return jsonResponse({ success: false, message: 'ارتباط با دیتابیس کاربران برقرار نشد.' }, 503);
  }
};
