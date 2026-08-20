type Env = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

type ArticleRow = {
  title?: string | null;
  slug?: string | null;
  summary?: string | null;
  published_at?: string | null;
  is_draft?: boolean | number | string | null;
};

type PageContext = {
  next: () => Promise<Response>;
  env?: Env;
};

const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_XaeRMCeIhR7-Zwq6YhdkVw_cOwO9OLt';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function renderLatestArticles(articles: ArticleRow[]): string {
  if (!articles.length) return '';

  const links = articles.map((article) => {
    const slug = String(article.slug || '').trim();
    const title = String(article.title || '').trim();
    if (!slug || !title) return '';
    const summary = stripHtml(String(article.summary || '')).slice(0, 180);
    const href = `/article/${encodeURIComponent(slug)}`;
    return `<li><a href="${esc(href)}">${esc(title)}</a>${summary ? `<p>${esc(summary)}</p>` : ''}</li>`;
  }).filter(Boolean).join('');

  if (!links) return '';

  return `<section id="solmint-seo-latest-articles" aria-labelledby="solmint-seo-latest-articles-title"><h2 id="solmint-seo-latest-articles-title">آخرین مقالات سولمینت</h2><ul>${links}</ul></section>`;
}

function inject(html: string, articles: ArticleRow[]): string {
  const section = renderLatestArticles(articles);
  if (!section) return html;
  if (!/<div id="root"><\/div>/i.test(html)) return html;
  return html.replace(/<div id="root"><\/div>/i, `<div id="root">${section}</div>`);
}

export async function onRequest(context: PageContext): Promise<Response> {
  const env = context.env || {};
  const base = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = String(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();
  const upstream = await context.next();

  if (!key || !upstream.ok) return upstream;

  let html = await upstream.text();
  if (!html || !/<div id="root"><\/div>/i.test(html)) {
    return new Response(html, { status: upstream.status, headers: upstream.headers });
  }

  try {
    const endpoint = `${base}/rest/v1/articles?select=title,slug,summary,published_at,is_draft&is_draft=eq.false&order=published_at.desc&limit=12`;
    const response = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json'
      }
    });
    if (response.ok) {
      const rows = await response.json();
      const articles = Array.isArray(rows) ? rows.filter((row: ArticleRow) => Boolean(row.slug) && Boolean(row.title) && !row.is_draft) : [];
      html = inject(html, articles);
    }
  } catch {
    // Preserve the normal SPA response if the discovery query fails.
  }

  const headers = new Headers(upstream.headers);
  headers.set('Content-Type', 'text/html; charset=UTF-8');
  headers.set('X-Solmint-SSR', 'homepage-article-discovery-v1');
  headers.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');
  return new Response(html, { status: upstream.status, headers });
}
