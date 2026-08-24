type PageContext = {
  request: Request;
  next: () => Promise<Response>;
  params: { slug: string };
};

/**
 * Tag archives remain usable for visitors and internal navigation, but they are
 * not part of Solmint's organic-search indexable inventory. This is enforced at
 * the HTTP layer so the directive is visible before client-side React runs.
 */
export async function onRequest(context: PageContext): Promise<Response> {
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
  headers.set('X-Solmint-SEO', 'tag-archive-noindex-v1');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
