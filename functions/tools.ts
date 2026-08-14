type ArticleRow = {
  id?: string | null;
  title?: string | null;
  slug?: string | null;
  category?: string | null;
  tags?: string[] | null;
  summary?: string | null;
  is_draft?: boolean | null;
};

type PageContext = { request: Request; next: () => Promise<Response>; env?: Record<string, string | undefined> };

const SITE_ORIGIN = 'https://solmint.ir';
const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_XaeRMCeIhR7-ZqYhdkVw_cOwO9OLt';

const TOOL_CONTEXT: Record<string, { title: string; keywords: string[] }> = {
  '/tools/solana-token-tools': {
    title: 'ابزارهای بررسی توکن سولانا',
    keywords: ['سولانا', 'توکن', 'token-2022', 'spl token', 'mint', 'authority', 'امنیت'],
  },
  '/tools/solana-token-scanner': {
    title: 'بررسی توکن سولانا',
    keywords: ['سولانا', 'توکن', 'token-2022', 'mint', 'mint authority', 'freeze authority', 'tokenomics', 'امنیت'],
  },
  '/tools/token-2022-inspector': {
    title: 'بازرس Token-2022',
    keywords: ['token-2022', 'سولانا', 'توکن', 'spl token', 'extension', 'transfer fee', 'transfer hook'],
  },
};

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
}

function normalize(value: unknown) {
  return String(value ?? '').toLocaleLowerCase('fa-IR').replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreArticle(article: ArticleRow, keywords: string[]) {
  const text = normalize(`${article.title} ${article.summary} ${(article.tags || []).join(' ')}`);
  let score = 0;
  for (const keyword of keywords) {
    if (text.includes(normalize(keyword))) score += keyword.length > 8 ? 4 : 2;
  }
  if (normalize(article.category).includes('سولانا')) score += 3;
  return score;
}

function relatedSection(articles: ArticleRow[], path: string) {
  const context = TOOL_CONTEXT[path];
  if (!context) return '';

  const related = articles
    .filter(article => !article.is_draft && article.slug && article.title)
    .map(article => ({ article, score: scoreArticle(article, context.keywords) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || String(b.article.title).localeCompare(String(a.article.title), 'fa'))
    .slice(0, 5)
    .map(item => item.article);

  if (!related.length) return '';

  const items = related.map(article => `<li><a href="${esc(`/article/${encodeURIComponent(String(article.slug).replace(/^\/+|\/+$/g, ''))}`)}">${esc(article.title)}</a></li>`).join('');

  return `<section id="tool-related-articles" dir="rtl" aria-labelledby="tool-related-articles-title"><div><h2 id="tool-related-articles-title">مقالات مرتبط</h2><ul>${items}</ul></div></section>`;
}

function inject(html: string, section: string) {
  if (!section) return html;
  const style = `<style id="tool-related-articles-style">#tool-related-articles{max-width:1200px;margin:0 auto;padding:0 16px 48px;color:#e2e8f0}#tool-related-articles>div{border:1px solid rgba(148,163,184,.16);border-radius:24px;background:rgba(15,23,42,.7);padding:20px}@media(min-width:640px){#tool-related-articles>div{padding:28px}}#tool-related-articles h2{margin:0;font-size:22px;font-weight:900;color:#fff}#tool-related-articles ul{margin:14px 0 0;padding:0;list-style:none;border-top:1px solid rgba(148,163,184,.12)}#tool-related-articles li{border-bottom:1px solid rgba(148,163,184,.12)}#tool-related-articles li:last-child{border-bottom:0}#tool-related-articles a{display:block;padding:12px 0;color:#e2e8f0;text-decoration:none;font-size:15px;font-weight:700;line-height:1.8}#tool-related-articles a:hover{color:#14F195}</style>`;
  return html.replace('</head>', `${style}</head>`).replace(/<div id="root"><\/div>/i, `<div id="root">${section}</div>`);
}

export async function onRequest(context: PageContext): Promise<Response> {
  const pathname = new URL(context.request.url).pathname.replace(/\/+$/, '') || '/';
  if (!TOOL_CONTEXT[pathname]) return context.next();

  const env = context.env || {};
  const base = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = String(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();

  let articles: ArticleRow[] = [];
  try {
    const endpoint = `${base}/rest/v1/articles?select=id,title,slug,category,tags,summary,is_draft&is_draft=eq.false&order=published_at.desc&limit=100`;
    const response = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } });
    if (response.ok) {
      const rows = await response.json();
      articles = Array.isArray(rows) ? rows : [];
    }
  } catch {
    articles = [];
  }

  const upstream = await context.next();
  const html = await upstream.text();
  if (!html) return upstream;

  const section = relatedSection(articles, pathname);
  const headers = new Headers(upstream.headers);
  headers.set('Content-Type', 'text/html; charset=UTF-8');
  headers.set('X-Solmint-SSR', 'tool-related-articles-v1');
  return new Response(inject(html, section), { status: upstream.status, headers });
}
