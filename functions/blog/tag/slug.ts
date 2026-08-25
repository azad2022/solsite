type PageContext = {
  next: () => Promise<Response>;
};

export async function onRequest(context: PageContext): Promise<Response> {
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, follow');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
