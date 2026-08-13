import { getAuthenticatedUser, jsonResponse, type Env } from './auth/_shared';

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
const VIRTUAL_COMMENT_TARGETS = new Set(['solana-price']);

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

const canModerateComments = (user: any) => {
  if (!user || user.is_active === false) return false;
  if (['superadmin', 'admin'].includes(String(user.role))) return true;
  return Array.isArray(user.permissions) && user.permissions.includes('comments');
};

const mapComment = (c: CommentRow, userVote = 0, includeInternalIdentity = false) => ({
  id: c.id,
  articleId: c.article_id,
  userName: c.user_name,
  ...(includeInternalIdentity ? { userId: c.user_id } : {}),
  text: c.text,
  createdAt: c.created_at ? new Date(c.created_at).toLocaleDateString('fa-IR') : 'اخیراً',
  approved: c.approved === true,
  parentId: c.parent_id || null,
  likeCount: Number(c.like_count || 0),
  dislikeCount: Number(c.dislike_count || 0),
  userVote: Number(userVote || 0)
});

async function resolveCanonicalArticleId(base: string, headers: Record<string, string>, requestedId: string): Promise<string | null> {
  if (!requestedId) return null;
  if (VIRTUAL_COMMENT_TARGETS.has(requestedId)) return requestedId;

  const byId = await fetch(
    `${base}/rest/v1/articles?select=id,slug&id=eq.${encodeURIComponent(requestedId)}&limit=1`,
    { headers }
  );
  const idRows = await byId.json().catch(() => []);
  if (byId.ok && Array.isArray(idRows) && idRows[0]?.id) return String(idRows[0].id);

  const bySlug = await fetch(
    `${base}/rest/v1/articles?select=id,slug&slug=eq.${encodeURIComponent(requestedId)}&limit=1`,
    { headers }
  );
  const slugRows = await bySlug.json().catch(() => []);
  if (bySlug.ok && Array.isArray(slugRows) && slugRows[0]?.id) return String(slugRows[0].id);

  return null;
}

export const onRequestGet = async ({ request, env }: { request: Request; env: CommentsEnv }) => {
  try {
    const { base, headers } = getDb(env);
    const url = new URL(request.url);
    const requestedArticleId = String(url.searchParams.get('articleId') || '').trim();
    const adminMode = url.searchParams.get('admin') === '1';
    const currentUser = await getAuthenticatedUser(env, request);
    const canModerate = canModerateComments(currentUser);

    if (adminMode && !canModerate) {
      return jsonResponse({ success: false, message: 'دسترسی مدیریت دیدگاه‌ها مجاز نیست.' }, 403);
    }
    if (!requestedArticleId && !canModerate) {
      return jsonResponse({ success: false, message: 'شناسه مقاله الزامی است.' }, 400);
    }

    const canonicalArticleId = requestedArticleId
      ? await resolveCanonicalArticleId(base, headers, requestedArticleId)
      : null;

    // Public article pages commonly address an article by slug while comments
    // are stored against the immutable articles.id. Resolve both forms here so
    // approval status is read from the same canonical records that add.ts writes.
    if (requestedArticleId && !canonicalArticleId) {
      return jsonResponse({ success: false, message: 'مقاله مورد نظر یافت نشد.', comments: [] }, 404);
    }

    const params = new URLSearchParams();
    params.set('select', '*');
    if (canonicalArticleId) params.set('article_id', `eq.${canonicalArticleId}`);
    if (!canModerate) params.set('approved', 'eq.true');
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
      comments: Array.isArray(rows) ? rows.map(row => mapComment(row, userVotes[String(row.id)] || 0, canModerate)) : []
    }, 200, { 'Cache-Control': 'no-store, no-cache, must-revalidate' });
  } catch (error) {
    console.error('Comments read error:', error);
    return jsonResponse({ success: false, message: 'خطا در دریافت دیدگاه‌ها.' }, 500, { 'Cache-Control': 'no-store' });
  }
};
