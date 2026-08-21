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
const BULK_TIMESTAMP_THRESHOLD = 10;

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value).replace(/\//g, '-'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function lastModified(article: ArticleRow, bulkUpdatedAt: Set<string>): string | null {
  const updated = String(article.updated_at || '').trim();
  const published = parseDate(article.published_at);
  const publishedGregorian = parseDate(article.published_at_gregorian);
  const updatedDate = parseDate(article.updated_at);

  // Large synchronized updates are treated as migration/admin noise rather than
  // evidence that every affected article's content materially changed.
  const preferred = updated && !bulkUpdatedAt.has(updated) ? updatedDate : null;
  const date = preferred || published || publishedGregorian || updatedDate;
  return date ? date.toISOString().split('T')[0] : null;
}

function isPublished(article: ArticleRow): boolean {
  return !(article.is_draft === true || article.is_draft === 1 || article.is_draft === 'true');
}

export const onRequestGet = async ({ env }: { env: Env }) => {
  const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!key) return new Response('Sitemap configuration error', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

  try {
    const endpoint = `${supabaseUrl}/rest/v1/articles?select=slug,updated_at,published_at,published_at_gregorian,is_draft&is_draft=eq.false&order=published_at.desc`;
    const response = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`articles query failed: ${response.status}`);
    const rows = await response.json() as ArticleRow[];
    if (!Array.isArray(rows)) throw new Error('articles query returned a non-array response');

    const updatedCounts = new Map<string, number>();
    for (const article of rows) {
      const updated = String(article.updated_at || '').trim();
      if (updated) updatedCounts.set(updated, (updatedCounts.get(updated) || 0) + 1);
    }
    const bulkUpdatedAt = new Set(
      Array.from(updatedCounts.entries())
        .filter(([, count]) => count >= BULK_TIMESTAMP_THRESHOLD)
        .map(([timestamp]) => timestamp)
    );

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    for (const article of rows) {
      if (!isPublished(article)) continue;
      const slug = String(article.slug || '').trim().replace(/^\/+|\/+$/g, '');
      if (!slug) continue;
      xml += `  <url>\n    <loc>${xmlEscape(`${BASE_URL}/article/${encodeURIComponent(slug)}`)}</loc>\n`;
      const lastmod = lastModified(article, bulkUpdatedAt);
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
