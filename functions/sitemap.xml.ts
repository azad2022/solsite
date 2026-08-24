const BASE_URL = 'https://solmint.ir';

export const onRequestGet = async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap>\n    <loc>${BASE_URL}/sitemap-pages.xml</loc>\n  </sitemap>\n  <sitemap>\n    <loc>${BASE_URL}/sitemap-articles.xml</loc>\n  </sitemap>\n  <sitemap>\n    <loc>${BASE_URL}/sitemap-taxonomy.xml</loc>\n  </sitemap>\n</sitemapindex>\n`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300'
    }
  });
};
