import { getAuthenticatedUser, type Env, jsonResponse } from './auth/_shared';

interface CommentsEnv extends Env {
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
}

type CommentRow = {
  id: string;
  article_id: string;
  user_name: string;
  user_id: string;
  text: string;
  created_at: string;
  approved: boolean;
  parent_id?: string | null;
  like_count?: number | null;
  dislike_count?: number | null;
};

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

const getDb = (env: CommentsEnv) => {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Supabase server secret is not configured.');
  const base = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
  return {
    base,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  };
};

const mapComment = (c: CommentRow, userVote = 0) => ({
  id: c.id,
  articleId: c.article_id,
  userName: c.user_name,
  userId: c.user_id,
  text: c.text,
  createdAt: c.created_at ? new Date(c.created_at).toLocaleDateString('fa-IR') : 'اخیراً',
  approved: c.approved === true,
  parentId: c.parent_id || null,
  likeCount: Number(c.like_count || 0),
  dislikeCount: Number(c.dislike_count || 0),
  userVote: Number(userVote || 0)
});

export const onRequestGet = async ({ request, env }: { request: Request; env: CommentsEnv }) => {
  try {
    const { base, headers } = getDb(env);
    const articleId = String(new URL(request.url).searchParams.get('articleId') || '').trim();
    const currentUser = await getAuthenticatedUser(env, request);
    const isAdmin = !!currentUser && ['superadmin', 'admin'].includes(String(currentUser.role));

    if (!articleId && !isAdmin) {
      return jsonResponse({ success: false, message: 'شناسه مقاله الزامی است.' }, 400);
    }

    const params = new URLSearchParams();
    params.set('select', '*');
    if (articleId) params.set('article_id', `eq.${articleId}`);
    if (!isAdmin) params.set('approved', 'eq.true');
    params.set('order', 'created_at.asc');

    const response = await fetch(`${base}/rest/v1/comments?${params.toString()}`, { headers });
    if (!response.ok) throw new Error(await response.text());

    const rows = await response.json() as CommentRow[];
    let userVotes: Record<string, number> = {};
    if (currentUser && rows.length) {
      const voteResponse = await fetch(
        `${base}/rest/v1/comment_votes?select=comment_id,vote&user_id=eq.${encodeURIComponent(currentUser.id)}`,
        { headers }
      );
      if (voteResponse.ok) {
        const votes = await voteResponse.json() as Array<{ comment_id: string; vote: number }>;
        userVotes = Object.fromEntries(votes.map(v => [String(v.comment_id), Number(v.vote)]));
      }
    }

    return jsonResponse({
      success: true,
      comments: Array.isArray(rows) ? rows.map(row => mapComment(row, userVotes[String(row.id)] || 0)) : []
    });
  } catch (error) {
    console.error('Comments read error:', error);
    return jsonResponse({ success: false, message: 'خطا در دریافت دیدگاه‌ها.' }, 500);
  }
};
