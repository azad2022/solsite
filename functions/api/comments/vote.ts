import { getAuthenticatedUser, type Env, jsonResponse } from '../auth/_shared';

interface CommentsEnv extends Env {
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  AUTH_RATE_LIMIT_SECRET?: string;
}

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

function getDb(env: CommentsEnv) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Supabase server secret is not configured.');
  const base = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, key };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function consumeRateLimit(env: CommentsEnv, request: Request, userId: string, secret: string): Promise<boolean> {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
  const sourceSecret = env.AUTH_RATE_LIMIT_SECRET || secret;
  const keyHash = await sha256(`${sourceSecret}:vote:${userId}:${ip}`);
  const response = await fetch(`${(env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '')}/rest/v1/rpc/consume_comment_rate_limit`, {
    method: 'POST',
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_key_hash: keyHash, p_operation: 'vote', p_window_seconds: 60, p_max_requests: 60 })
  });
  if (!response.ok) throw new Error(`comment vote rate limiter failed: ${response.status}`);
  return Boolean(await response.json());
}

export const onRequestPost = async ({ request, env }: { request: Request; env: CommentsEnv }) => {
  try {
    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false) return jsonResponse({ success: false, message: 'برای رأی دادن باید وارد حساب کاربری خود شوید.' }, 401);

    const body = await request.json().catch(() => null) as { commentId?: unknown; vote?: unknown } | null;
    if (!body) return jsonResponse({ success: false, message: 'درخواست رأی نامعتبر است.' }, 400);
    const commentId = String(body.commentId || '').trim();
    const vote = Number(body.vote);
    if (!commentId || ![-1, 0, 1].includes(vote)) return jsonResponse({ success: false, message: 'رأی نامعتبر است.' }, 400);

    const { base, headers, key } = getDb(env);
    const allowed = await consumeRateLimit(env, request, String(user.id), key);
    if (!allowed) return jsonResponse({ success: false, message: 'تعداد رأی‌های شما در این دقیقه بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.' }, 429, { 'Retry-After': '60' });

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
