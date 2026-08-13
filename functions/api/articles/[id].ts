const ARTICLE_FUNCTION_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co/functions/v1/article-publish-api';
const SESSION_COOKIE = '__Host-solmint_session';

function getSessionToken(request: Request): string {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
  });
}

export const onRequestDelete = async ({ request, params }: { request: Request; params: { id?: string } }) => {
  const sessionToken = getSessionToken(request);
  if (!sessionToken) {
    return json({ success: false, code: 'SESSION_REQUIRED', message: 'نشست مدیریت معتبر نیست. لطفاً دوباره وارد شوید.' }, 401);
  }

  const id = String(params?.id || '').trim();
  if (!id) return json({ success: false, code: 'ARTICLE_ID_MISSING', message: 'شناسه مقاله مشخص نشده است.' }, 400);

  try {
    const response = await fetch(`${ARTICLE_FUNCTION_URL}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-solmint-session-token': sessionToken }
    });
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (error) {
    console.error('Article delete proxy failed:', error);
    return json({ success: false, code: 'ARTICLE_DELETE_PROXY_FAILED', message: 'ارتباط با سرویس حذف مقاله برقرار نشد.' }, 502);
  }
};
