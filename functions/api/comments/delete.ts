import { getAuthenticatedUser, type Env, jsonResponse } from '../auth/_shared';

interface CommentsEnv extends Env {
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
}

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

function getDb(env: CommentsEnv) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Supabase server secret is not configured.');
  const base = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' } };
}

export const onRequestPost = async ({ request, env }: { request: Request; env: CommentsEnv }) => {
  try {
    const user = await getAuthenticatedUser(env, request);
    if (!user || !['superadmin', 'admin'].includes(String(user.role))) return jsonResponse({ success: false, message: 'دسترسی مدیریت نظرات مجاز نیست.' }, 403);

    const body = await request.json() as { commentId?: unknown };
    const commentId = String(body.commentId || '').trim();
    if (!commentId) return jsonResponse({ success: false, message: 'شناسه دیدگاه الزامی است.' }, 400);

    const { base, headers } = getDb(env);
    const response = await fetch(`${base}/rest/v1/comments?id=eq.${encodeURIComponent(commentId)}`, { method: 'DELETE', headers });
    if (!response.ok) throw new Error(await response.text());
    return jsonResponse({ success: true, message: 'دیدگاه حذف شد.' });
  } catch (error) {
    console.error('Comment deletion error:', error);
    return jsonResponse({ success: false, message: 'خطا در حذف دیدگاه.' }, 500);
  }
};
