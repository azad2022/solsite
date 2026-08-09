interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const articleId = String(new URL(request.url).searchParams.get('articleId') || '').trim();
  if (!articleId) return Response.json({ success: false, message: 'شناسه صفحه الزامی است.' }, { status: 400 });
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return Response.json({ success: false, message: 'پایگاه داده در دسترس نیست.' }, { status: 503 });

  try {
    const base = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
    const url = `${base}/rest/v1/comments?select=*&article_id=eq.${encodeURIComponent(articleId)}&approved=eq.true&order=created_at.asc`;
    const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json();
    const comments = Array.isArray(rows) ? rows.map((c: any) => ({
      id: c.id, articleId: c.article_id, userName: c.user_name, userId: c.user_id, text: c.text,
      createdAt: c.created_at ? new Date(c.created_at).toLocaleDateString('fa-IR') : 'اخیراً',
      approved: true, parentId: c.parent_id || null,
      likeCount: Number(c.like_count || 0), dislikeCount: Number(c.dislike_count || 0)
    })) : [];
    return Response.json({ success: true, comments }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Comments read error:', error);
    return Response.json({ success: false, message: 'خطا در دریافت دیدگاه‌ها.' }, { status: 500 });
  }
};
