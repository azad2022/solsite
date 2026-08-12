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
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } };
}

export const onRequestPost = async ({ request, env }: { request: Request; env: CommentsEnv }) => {
  try {
    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false) return jsonResponse({ success: false, message: 'برای رأی دادن باید وارد حساب کاربری خود شوید.' }, 401);

    const body = await request.json() as { commentId?: unknown; vote?: unknown };
    const commentId = String(body.commentId || '').trim();
    const vote = Number(body.vote);
    if (!commentId || ![-1, 0, 1].includes(vote)) return jsonResponse({ success: false, message: 'رأی نامعتبر است.' }, 400);

    const { base, headers } = getDb(env);
    const commentResponse = await fetch(`${base}/rest/v1/comments?select=id,approved&id=eq.${encodeURIComponent(commentId)}&limit=1`, { headers });
    if (!commentResponse.ok) throw new Error(await commentResponse.text());
    const comments = await commentResponse.json();
    const comment = Array.isArray(comments) ? comments[0] : null;
    if (!comment || comment.approved !== true) return jsonResponse({ success: false, message: 'دیدگاه یافت نشد.' }, 404);

    const rpcResponse = await fetch(`${base}/rest/v1/rpc/set_comment_vote`, {
      method: 'POST', headers,
      body: JSON.stringify({ p_comment_id: commentId, p_user_id: String(user.id), p_vote: vote })
    });
    if (!rpcResponse.ok) throw new Error(await rpcResponse.text());

    const result = await rpcResponse.json();
    const row = Array.isArray(result) ? result[0] : result;
    return jsonResponse({ success: true, like_count: Number(row?.like_count || 0), dislike_count: Number(row?.dislike_count || 0), user_vote: Number(row?.user_vote || 0) });
  } catch (error) {
    console.error('Comment vote error:', error);
    return jsonResponse({ success: false, message: 'خطا در ثبت رأی.' }, 500);
  }
};
