import { getAuthenticatedUser, type Env, jsonResponse } from '../auth/_shared';

interface CommentsEnv extends Env {
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
}

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

const getDb = (env: CommentsEnv) => {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Supabase server secret is not configured.');
  const base = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
  return { base, headers };
};

export const onRequestPost = async ({ request, env }: { request: Request; env: CommentsEnv }) => {
  try {
    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false) {
      return jsonResponse({ success: false, message: 'برای ثبت دیدگاه باید وارد حساب کاربری خود شوید.' }, 401);
    }

    const body = await request.json() as { articleId?: unknown; text?: unknown; parentId?: unknown };
    const articleId = String(body.articleId || '').trim();
    const text = String(body.text || '').replace(/\r\n/g, '\n').trim();
    const parentId = body.parentId ? String(body.parentId).trim() : null;

    if (!articleId) return jsonResponse({ success: false, message: 'شناسه مقاله الزامی است.' }, 400);
    if (text.length < 3 || text.length > 4000) {
      return jsonResponse({ success: false, message: 'متن دیدگاه باید بین ۳ تا ۴۰۰۰ کاراکتر باشد.' }, 400);
    }

    const { base, headers } = getDb(env);
    const articleLookup = await fetch(
      `${base}/rest/v1/articles?select=id,slug&id=eq.${encodeURIComponent(articleId)}&limit=1`,
      { headers }
    );
    let articles = await articleLookup.json().catch(() => []);
    if (!articleLookup.ok || !Array.isArray(articles) || !articles[0]) {
      const slugLookup = await fetch(
        `${base}/rest/v1/articles?select=id,slug&slug=eq.${encodeURIComponent(articleId)}&limit=1`,
        { headers }
      );
      articles = await slugLookup.json().catch(() => []);
      if (!slugLookup.ok || !Array.isArray(articles) || !articles[0]) {
        return jsonResponse({ success: false, message: 'مقاله مورد نظر یافت نشد.' }, 404);
      }
    }

    const canonicalArticleId = String(articles[0].id);

    if (parentId) {
      const parentResponse = await fetch(
        `${base}/rest/v1/comments?select=id,article_id,approved&id=eq.${encodeURIComponent(parentId)}&limit=1`,
        { headers }
      );
      const parents = await parentResponse.json().catch(() => []);
      const parent = Array.isArray(parents) ? parents[0] : null;
      if (!parent || String(parent.article_id) !== canonicalArticleId || parent.approved !== true) {
        return jsonResponse({ success: false, message: 'نظر والد معتبر نیست.' }, 400);
      }
    }

    const id = `comment-${crypto.randomUUID()}`;
    const displayName = String(user.full_name || user.username || 'کاربر سولمینت').trim().slice(0, 80);
    if (displayName.length < 2) {
      return jsonResponse({ success: false, message: 'نام حساب کاربری معتبر نیست.' }, 400);
    }

    const row = {
      id,
      article_id: canonicalArticleId,
      user_name: displayName,
      user_id: String(user.id),
      text,
      parent_id: parentId,
      approved: false
    };

    const response = await fetch(`${base}/rest/v1/comments`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(row)
    });
    const responseText = await response.text();
    if (!response.ok) {
      console.error('Comment insert error:', response.status, responseText);
      return jsonResponse({ success: false, message: 'خطا در ثبت دیدگاه. لطفاً دوباره تلاش کنید.' }, 500);
    }

    const inserted = JSON.parse(responseText)?.[0] || row;
    return jsonResponse({
      success: true,
      comment: {
        id: inserted.id,
        articleId: inserted.article_id,
        userName: inserted.user_name,
        userId: inserted.user_id,
        text: inserted.text,
        createdAt: 'در انتظار تأیید',
        approved: false,
        parentId: inserted.parent_id || null,
        likeCount: 0,
        dislikeCount: 0,
        userVote: 0
      },
      message: 'دیدگاه شما ثبت شد و پس از تأیید مدیر منتشر می‌شود.'
    }, 201);
  } catch (error) {
    console.error('Comment creation error:', error);
    return jsonResponse({ success: false, message: 'خطا در ثبت دیدگاه. لطفاً دوباره تلاش کنید.' }, 500);
  }
};
