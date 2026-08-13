import { getAuthenticatedUser, type Env, jsonResponse } from '../auth/_shared';

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

function db(env: Env) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Supabase server secret is not configured.');
  return {
    base: (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, ''),
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  };
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const user = await getAuthenticatedUser(env, request);
    if (!user || !['superadmin', 'admin'].includes(String(user.role))) {
      return jsonResponse({ success: false, message: 'نشست مدیر معتبر نیست.' }, 401);
    }

    const { base, headers } = db(env);
    const response = await fetch(`${base}/rest/v1/cms_settings?select=id,settings_json&id=eq.main_settings&limit=1`, { headers });
    if (!response.ok) throw new Error(`Settings query failed: ${response.status}`);
    const rows = await response.json() as Array<{ settings_json?: Record<string, any> | null }>;
    const settings = rows[0]?.settings_json && typeof rows[0].settings_json === 'object' ? rows[0].settings_json : {};

    // Do not expose password material even to the admin UI. The DeepSeek API key is
    // retained server-side for authenticated operations but is intentionally masked here.
    const safe = structuredClone(settings);
    if (safe.security && typeof safe.security === 'object') delete safe.security.adminPasscode;
    if (safe.deepseek && typeof safe.deepseek === 'object' && safe.deepseek.apiKey) {
      safe.deepseek.apiKey = '••••••••';
    }
    if (safe.deepseek && typeof safe.deepseek === 'object' && Array.isArray(safe.deepseek.apiKeys)) {
      safe.deepseek.apiKeys = safe.deepseek.apiKeys.map(() => '••••••••');
    }
    if (safe.github && typeof safe.github === 'object') {
      if (safe.github.token) safe.github.token = '••••••••';
      if (safe.github.accessToken) safe.github.accessToken = '••••••••';
    }
    if (safe.media && typeof safe.media === 'object') {
      if (safe.media.token) safe.media.token = '••••••••';
      if (safe.media.accessToken) safe.media.accessToken = '••••••••';
    }

    return jsonResponse({ success: true, settings: safe });
  } catch (error) {
    console.error('Admin CMS settings GET failed:', error);
    return jsonResponse({ success: false, message: 'دریافت تنظیمات مدیر انجام نشد.' }, 503);
  }
};
