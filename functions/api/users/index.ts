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
    const actor = await getAuthenticatedUser(env, request);
    if (!actor || !['superadmin', 'admin'].includes(String(actor.role))) {
      return jsonResponse({ success: false, message: 'دسترسی مدیر معتبر نیست.' }, 401);
    }
    const { base, headers } = db(env);
    const response = await fetch(`${base}/rest/v1/users?select=id,username,full_name,role,permissions,is_active,created_at&order=created_at.desc`, { headers });
    if (!response.ok) throw new Error(`Supabase users query failed: ${response.status}`);
    const rows = await response.json() as Array<Record<string, unknown>>;
    const users = rows.map(user => ({
      id: String(user.id || ''),
      username: String(user.username || ''),
      fullName: String(user.full_name || ''),
      role: String(user.role || 'user'),
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      isActive: user.is_active !== false,
      createdAt: String(user.created_at || ''),
    }));
    return jsonResponse({ success: true, users });
  } catch (error) {
    console.error('Admin user list failed:', error);
    return jsonResponse({ success: false, message: 'دریافت فهرست کاربران انجام نشد.' }, 503);
  }
};
