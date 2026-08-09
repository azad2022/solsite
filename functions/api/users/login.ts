interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

type UserRow = {
  id: string;
  username: string;
  full_name: string;
  password_hash: string;
  role: string;
  permissions: unknown;
  is_active: boolean;
  created_at: string;
};

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' }
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return jsonResponse({ success: false, message: 'اتصال امن به دیتابیس پیکربندی نشده است.' }, 503);

    const body = await request.json() as { username?: unknown; passwordHash?: unknown; passcode?: unknown };
    const username = String(body.username || '').trim().toLowerCase();
    const passcode = String(body.passcode || '').trim();
    const suppliedHash = String(body.passwordHash || '').trim();
    if (!username || (!passcode && !suppliedHash)) {
      return jsonResponse({ success: false, message: 'نام کاربری و رمز عبور الزامی است.' }, 400);
    }

    const base = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const response = await fetch(`${base}/rest/v1/users?select=id,username,full_name,password_hash,role,permissions,is_active,created_at&username=eq.${encodeURIComponent(username)}&limit=1`, { headers });
    if (!response.ok) throw new Error(await response.text());

    const rows = await response.json() as UserRow[];
    const user = rows[0];
    if (!user || user.is_active === false) {
      return jsonResponse({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' }, 401);
    }

    const hashedPasscode = passcode ? await sha256(passcode) : '';
    const valid =
      (suppliedHash && suppliedHash === user.password_hash) ||
      (passcode && passcode === user.password_hash) ||
      (hashedPasscode && hashedPasscode === user.password_hash);

    if (!valid) return jsonResponse({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' }, 401);

    // Never send password_hash to the browser.
    const safeUser = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      isActive: user.is_active,
      createdAt: user.created_at
    };

    return jsonResponse({ success: true, user: safeUser, isSuperAdmin: user.role === 'superadmin' });
  } catch (error) {
    console.error('Production user login error:', error);
    return jsonResponse({ success: false, message: 'ارتباط با دیتابیس احراز هویت برقرار نشد.' }, 503);
  }
};
