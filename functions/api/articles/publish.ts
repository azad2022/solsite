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
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

export const onRequestOptions = async () => new Response(null, {
  status: 204,
  headers: {
    'Access-Control-Allow-Origin': 'same-origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600'
  }
});

export const onRequestPost = async ({ request }: { request: Request }) => {
  const sessionToken = getSessionToken(request);
  if (!sessionToken) {
    return json({ success: false, code: 'SESSION_REQUIRED', message: 'نشست مدیریت معتبر نیست. لطفاً دوباره وارد شوید.' }, 401);
  }

  try {
    const body = await request.text();
    const response = await fetch(ARTICLE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('Content-Type') || 'application/json',
        'x-solmint-session-token': sessionToken
      },
      body
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
    console.error('Article publish proxy failed:', error);
    return json({ success: false, code: 'ARTICLE_PUBLISH_PROXY_FAILED', message: 'ارتباط با سرویس انتشار مقاله برقرار نشد.' }, 502);
  }
};
