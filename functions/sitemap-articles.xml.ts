type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

type ArticleRow = {
  slug?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
  published_at_gregorian?: string | null;
  is_draft?: boolean | number | string | null;
};

const BASE_URL = 'https://solmint.ir';
const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function lastModified(article: ArticleRow): string | null {
  const raw = article.updated_at || article.published_at || article.published_at_gregorian;
  if (!raw) return null;
  const date = new Date(String(raw).replace(/\//g, '-'));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
}

function isPublished(article: ArticleRow): boolean {
  return !(article.is_draft === true || article.is_draft === 1 || article.is_draft === 'true');
}

export const onRequestGet = async ({ env }: { env: Env }) => {
  const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!key) return new Response('Sitemap configuration error', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

  try {
    const endpoint = `${supabaseUrl}/rest/v1/articles?select=slug,updated_at,published_at,published_at_gregorian,is_draft&is_draft=eq.false&order=updated_at.desc`;
    const response = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`articles query failed: ${response.status}`);
    const rows = await response.json() as ArticleRow[];
    if (!Array.isArray(rows)) throw new Error('articles query returned a non-array response');

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    for (const article of rows) {
      if (!isPublished(article)) continue;
      const slug = String(article.slug || '').trim().replace(/^\/+|\/+$/g, '');
      if (!slug) continue;
      xml += `  <url>\n    <loc>${xmlEscape(`${BASE_URL}/article/${encodeURIComponent(slug)}`)}</loc>\n`;
      const lastmod = lastModified(article);
      if (lastmod) xml += `    <lastmod>${xmlEscape(lastmod)}</lastmod>\n`;
      xml += '  </url>\n';
    }
    xml += '</urlset>\n';

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    console.error('Article sitemap generation failed:', error);
    return new Response('Article sitemap temporarily unavailable', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
};
