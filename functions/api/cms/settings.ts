import { getAuthenticatedUser, type Env, jsonResponse } from '../auth/_shared';

type CmsSettingsRow = {
  id: string;
  settings_json: Record<string, any> | null;
};

interface SettingsEnv extends Env {
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

function db(env: SettingsEnv) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('Supabase server secret is not configured.');
  const base = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } };
}

async function getSettings(env: SettingsEnv): Promise<Record<string, any>> {
  const { base, headers } = db(env);
  const response = await fetch(`${base}/rest/v1/cms_settings?select=id,settings_json&id=eq.main_settings&limit=1`, { headers });
  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json() as CmsSettingsRow[];
  const settings = rows[0]?.settings_json && typeof rows[0].settings_json === 'object' ? rows[0].settings_json : {};
  settings.chatbot = settings.chatbot && typeof settings.chatbot === 'object' ? settings.chatbot : {};
  settings.chatbot.enabled = settings.chatbot.enabled === true;
  return settings;
}

export const onRequestGet = async ({ env }: { env: SettingsEnv }) => {
  try {
    return jsonResponse({ success: true, settings: await getSettings(env) });
  } catch (error) {
    console.error('CMS settings GET failed:', error);
    return jsonResponse({ success: false, message: 'اتصال به دیتابیس تنظیمات برقرار نشد.' }, 503);
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: SettingsEnv }) => {
  try {
    const user = await getAuthenticatedUser(env, request);
    if (!user || !['superadmin', 'admin'].includes(String(user.role))) {
      return jsonResponse({ success: false, message: 'نشست مدیر معتبر نیست. لطفاً دوباره وارد شوید.' }, 401);
    }

    const body = await request.json() as { settings?: Record<string, any> };
    if (!body?.settings || typeof body.settings !== 'object') {
      return jsonResponse({ success: false, message: 'داده تنظیمات نامعتبر است.' }, 400);
    }

    const current = await getSettings(env);
    const incoming = body.settings;
    const newAdminPasscode = typeof incoming.security?.adminPasscode === 'string' ? incoming.security.adminPasscode.trim() : '';
    if (newAdminPasscode && newAdminPasscode.length < 8) {
      return jsonResponse({ success: false, message: 'رمز عبور مدیر باید حداقل ۸ کاراکتر باشد.' }, 400);
    }

    const updated = {
      ...current,
      ...incoming,
      chatbot: { ...(current.chatbot || {}), ...(incoming.chatbot || {}) },
      deepseek: { ...(current.deepseek || {}), ...(incoming.deepseek || {}) },
      downloads: { ...(current.downloads || {}), ...(incoming.downloads || {}) },
      security: { ...(current.security || {}), ...(incoming.security || {}) }
    };

    // Passwords belong exclusively to users.password_hash, never to CMS settings.
    delete updated.security.adminPasscode;
    updated.chatbot.enabled = incoming.chatbot?.enabled === true;

    const { base, headers } = db(env);
    const settingsResponse = await fetch(`${base}/rest/v1/cms_settings`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ id: 'main_settings', settings_json: updated, updated_at: new Date().toISOString() })
    });
    if (!settingsResponse.ok) throw new Error(await settingsResponse.text());

    if (newAdminPasscode) {
      // Keep compatibility with the existing login migration: the next successful login upgrades SHA-256 to PBKDF2.
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(newAdminPasscode));
      const passwordHash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
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
