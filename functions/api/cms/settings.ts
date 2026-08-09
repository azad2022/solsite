type CmsSettingsRow = {
  id: string;
  settings_json: Record<string, any> | null;
};

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

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Vary': 'Origin'
    }
  });
}

function db(env: Env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured in Cloudflare.');
  const base = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } };
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSettings(env: Env): Promise<Record<string, any>> {
  const { base, headers } = db(env);
  const response = await fetch(`${base}/rest/v1/cms_settings?select=id,settings_json&id=eq.main_settings&limit=1`, { headers });
  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json() as CmsSettingsRow[];
  const settings = rows[0]?.settings_json && typeof rows[0].settings_json === 'object' ? rows[0].settings_json : {};
  settings.chatbot = settings.chatbot && typeof settings.chatbot === 'object' ? settings.chatbot : {};
  settings.chatbot.enabled = settings.chatbot.enabled === true;
  return settings;
}

async function getAdminUser(env: Env): Promise<UserRow | null> {
  const { base, headers } = db(env);
  const response = await fetch(`${base}/rest/v1/users?select=id,username,full_name,password_hash,role,permissions,is_active,created_at&username=eq.admin&limit=1`, { headers });
  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json() as UserRow[];
  return rows[0] || null;
}

async function authorizeAdmin(request: Request, env: Env): Promise<boolean> {
  const supplied = String(request.headers.get('x-admin-passcode') || '').trim();
  if (!supplied) return false;
  const user = await getAdminUser(env);
  if (!user || user.is_active === false) return false;
  const hashed = await sha256(supplied);
  // Support the legacy plaintext/placeholder row during migration, but all new passwords are SHA-256.
  return supplied === user.password_hash || hashed === user.password_hash || supplied === String((globalThis as any).ADMIN_PASSCODE || '');
}

export const onRequestGet = async ({ env }: { env: Env }) => {
  try {
    return jsonResponse({ success: true, settings: await getSettings(env) });
  } catch (error) {
    console.error('CMS settings GET failed:', error);
    return jsonResponse({ success: false, message: 'اتصال به دیتابیس تنظیمات برقرار نشد.' }, 503);
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    if (!(await authorizeAdmin(request, env))) {
      return jsonResponse({ success: false, message: 'نشست مدیر معتبر نیست. لطفاً دوباره وارد شوید.' }, 401);
    }

    const body = await request.json() as { settings?: Record<string, any> };
    if (!body?.settings || typeof body.settings !== 'object') {
      return jsonResponse({ success: false, message: 'داده تنظیمات نامعتبر است.' }, 400);
    }

    const current = await getSettings(env);
    const incoming = body.settings;
    const updated = {
      ...current,
      ...incoming,
      chatbot: { ...(current.chatbot || {}), ...(incoming.chatbot || {}) },
      deepseek: { ...(current.deepseek || {}), ...(incoming.deepseek || {}) },
      downloads: { ...(current.downloads || {}), ...(incoming.downloads || {}) },
      security: { ...(current.security || {}), ...(incoming.security || {}) }
    };

    // Never persist a string such as "false" as an enabled flag.
    updated.chatbot.enabled = incoming.chatbot?.enabled === true;

    // The admin password belongs in the users table, not in public CMS settings.
    const newAdminPasscode = typeof incoming.security?.adminPasscode === 'string'
      ? incoming.security.adminPasscode.trim()
      : '';
    delete updated.security.adminPasscode;

    const { base, headers } = db(env);
    const settingsResponse = await fetch(`${base}/rest/v1/cms_settings`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ id: 'main_settings', settings_json: updated, updated_at: new Date().toISOString() })
    });
    if (!settingsResponse.ok) throw new Error(await settingsResponse.text());

    if (newAdminPasscode) {
      if (newAdminPasscode.length < 8) {
        return jsonResponse({ success: false, message: 'رمز عبور مدیر باید حداقل ۸ کاراکتر باشد.' }, 400);
      }
      const passwordHash = await sha256(newAdminPasscode);
      const userResponse = await fetch(`${base}/rest/v1/users?username=eq.admin`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ password_hash: passwordHash })
      });
      if (!userResponse.ok) throw new Error(await userResponse.text());
    }

    return jsonResponse({ success: true, settings: updated, message: 'تنظیمات با موفقیت در Supabase ذخیره شد.' });
  } catch (error) {
    console.error('CMS settings POST failed:', error);
    return jsonResponse({ success: false, message: 'ذخیره تنظیمات در دیتابیس انجام نشد.' }, 500);
  }
};
