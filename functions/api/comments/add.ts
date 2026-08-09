interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

function sessionFrom(request: Request): string {
  return request.headers.get('Cookie')?.match(/(?:^|;\s*)solmint_comment_session=([^;]+)/)?.[1] || `cmt-${crypto.randomUUID()}`;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return Response.json({ success: false, message: 'پایگاه داده در دسترس نیست.' }, { status: 503 });

  try {
    const body = await request.json() as { articleId?: unknown; userName?: unknown; text?: unknown; parentId?: unknown };
    const articleId = String(body.articleId || '').trim();
    const userName = String(body.userName || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 80);
    const text = String(body.text || '').replace(/\r\n/g, '\n').trim();
    const parentId = body.parentId ? String(body.parentId).trim() : null;

    if (articleId !== 'solana-price') return Response.json({ success: false, message: 'این صفحه برای این endpoint معتبر نیست.' }, { status: 400 });
    if (userName.length < 2 || text.length < 3 || text.length > 4000) return Response.json({ success: false, message: 'نام یا متن دیدگاه طول نامعتبر دارد.' }, { status: 400 });

    const base = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };

    if (parentId) {
      const parentResponse = await fetch(`${base}/rest/v1/comments?select=id,article_id,approved&id=eq.${encodeURIComponent(parentId)}&limit=1`, { headers });
      const parents = await parentResponse.json();
      const parent = Array.isArray(parents) ? parents[0] : null;
      if (!parent || String(parent.article_id) !== 'solana-price' || parent.approved !== true) return Response.json({ success: false, message: 'نظر والد معتبر نیست.' }, { status: 400 });
    }

    const id = `comment-${crypto.randomUUID()}`;
    const row = { id, article_id: 'solana-price', user_name: userName, user_id: sessionFrom(request), text, parent_id: parentId, approved: false };
    const response = await fetch(`${base}/rest/v1/comments`, { method: 'POST', headers, body: JSON.stringify(row) });
    const responseText = await response.text();
    if (!response.ok) {
      console.error('Solana price comment insert error:', response.status, responseText);
      return Response.json({ success: false, message: 'خطا در ثبت دیدگاه. لطفاً دوباره تلاش کنید.' }, { status: 500 });
    }

    const inserted = JSON.parse(responseText)?.[0] || row;
    const outHeaders = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    if (!request.headers.get('Cookie')?.match(/(?:^|;\s*)solmint_comment_session=/)) {
      outHeaders.append('Set-Cookie', `solmint_comment_session=${encodeURIComponent(String(row.user_id))}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`);
    }
    return new Response(JSON.stringify({
      success: true,
      comment: { id: inserted.id, articleId: 'solana-price', userName: inserted.user_name, userId: inserted.user_id, text: inserted.text, createdAt: 'در انتظار تأیید', approved: false, parentId: inserted.parent_id || null, likeCount: 0, dislikeCount: 0 },
      message: 'دیدگاه شما ثبت شد و پس از تأیید مدیر منتشر می‌شود.'
    }), { status: 201, headers: outHeaders });
  } catch (error) {
    console.error('Solana price comment creation error:', error);
    return Response.json({ success: false, message: 'خطا در ثبت دیدگاه. لطفاً دوباره تلاش کنید.' }, { status: 500 });
  }
};
