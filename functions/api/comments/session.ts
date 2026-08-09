export const onRequestGet = async ({ request }: { request: Request }) => {
  const existing = request.headers.get('Cookie')?.match(/(?:^|;\s*)solmint_comment_session=([^;]+)/)?.[1];
  const sessionId = existing || `cmt-${crypto.randomUUID()}`;
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  if (!existing) headers.append('Set-Cookie', `solmint_comment_session=${encodeURIComponent(sessionId)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax; Secure`);
  return new Response(JSON.stringify({ success: true, sessionId }), { status: 200, headers });
};
