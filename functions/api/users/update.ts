interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  is_active: boolean;
}

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' } });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getAdmin(env: Env): Promise<UserRow | null> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  const base = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
  const response = await fetch(`${base}/rest/v1/users?select=id,username,password_hash,is_active&username=eq.admin&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json() as UserRow[])[0] || null;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return jsonResponse({ success: false, message: 'اتصال امن به دیتابیس پیکربندی نشده است.' }, 503);

    const supplied = String(request.headers.get('x-admin-passcode') || '').trim();
    const admin = await getAdmin(env);
    if (!supplied || !admin || admin.is_active === false) return jsonResponse({ success: false, message: 'احراز هویت مدیر نامعتبر است.' }, 401);

    const suppliedHash = await sha256(supplied);
    if (supplied !== admin.password_hash && suppliedHash !== admin.password_hash) {
      return jsonResponse({ success: false, message: 'رمز مدیر برای انجام این عملیات معتبر نیست.' }, 401);
    }

    const body = await request.json() as {
      userId?: unknown;
      role?: unknown;
      permissions?: unknown;
      isActive?: unknown;
      passwordHash?: unknown;
    };
    const userId = String(body.userId || '').trim();
    if (!userId) return jsonResponse({ success: false, message: 'شناسه کاربر الزامی است.' }, 400);

    const patch: Record<string, unknown> = {};
    if (typeof body.role === 'string' && body.role.trim()) patch.role = body.role.trim();
    if (Array.isArray(body.permissions)) patch.permissions = body.permissions;
    if (typeof body.isActive === 'boolean') patch.is_active = body.isActive;
    if (typeof body.passwordHash === 'string' && /^[a-f0-9]{64}$/i.test(body.passwordHash.trim())) {
      patch.password_hash = body.passwordHash.trim().toLowerCase();
    }

    if (Object.keys(patch).length === 0) return jsonResponse({ success: false, message: 'هیچ تغییری برای ذخیره وجود ندارد.' }, 400);

    const base = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
    const response = await fetch(`${base}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(patch)
    });

    const text = await response.text();
    if (!response.ok) {
      console.error('User update error:', response.status, text);
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
    console.error('Production user update error:', error);
    return jsonResponse({ success: false, message: 'ارتباط با دیتابیس کاربران برقرار نشد.' }, 503);
  }
};
