type ArticleRow = {
  title?: string | null;
  slug?: string | null;
  category?: string | null;
  tags?: string[] | null;
  summary?: string | null;
  is_draft?: boolean | null;
};

type MiddlewareContext = {
  request: Request;
  next: () => Promise<Response>;
  env?: Record<string, string | undefined>;
};

const BASE_URL = 'https://solmint.ir';
const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_XaeRMCeIhR7-ZwqYhdkVw_cOwO9OLt';

const TOOL_CONTEXT: Record<string, string[]> = {
  '/tools/solana-token-tools': ['سولانا', 'توکن', 'token-2022', 'spl token', 'mint', 'authority', 'امنیت'],
  '/tools/solana-token-scanner': ['سولانا', 'توکن', 'token-2022', 'mint', 'mint authority', 'freeze authority', 'tokenomics', 'امنیت'],
  '/tools/token-2022-inspector': ['token-2022', 'سولانا', 'توکن', 'spl token', 'extension', 'transfer fee', 'transfer hook'],
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalize(value: unknown): string {
  return String(value ?? '')
    .toLocaleLowerCase('fa-IR')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreArticle(article: ArticleRow, keywords: string[]): number {
  const text = normalize(`${article.title} ${article.summary} ${(article.tags || []).join(' ')}`);
  let score = 0;

  for (const keyword of keywords) {
    if (text.includes(normalize(keyword))) score += keyword.length > 8 ? 4 : 2;
  }

  if (normalize(article.category).includes('سولانا')) score += 3;
  return score;
}

function selectRelatedArticles(articles: ArticleRow[], path: string): ArticleRow[] {
  const keywords = TOOL_CONTEXT[path];
  if (!keywords) return [];

  return articles
    .filter(article => article.is_draft !== true && Boolean(article.slug) && Boolean(article.title))
    .map(article => ({ article, score: scoreArticle(article, keywords) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(item => item.article);
}

function renderRelatedArticles(articles: ArticleRow[]): string {
  if (!articles.length) return '';

  const items = articles.map(article => {
    const slug = String(article.slug || '').replace(/^\/+|\/+$/g, '');
    const href = `${BASE_URL}/article/${encodeURIComponent(slug)}`;
    return `<li><a href="${escapeHtml(href)}">${escapeHtml(article.title)}</a></li>`;
  }).join('');

  return `
<section id="solmint-related-articles" dir="rtl" aria-labelledby="solmint-related-articles-title">
  <div class="solmint-related-articles-card">
    <h2 id="solmint-related-articles-title">مقالات مرتبط</h2>
    <nav aria-label="مقالات مرتبط با این ابزار">
      <ul>${items}</ul>
    </nav>
  </div>
</section>`;
}

const RELATED_STYLES = `<style id="solmint-related-articles-style">
#solmint-related-articles{width:100%;box-sizing:border-box;padding:0 1rem 3rem;margin:0 auto;max-width:1152px;color:#e2e8f0}
.solmint-related-articles-card{box-sizing:border-box;border:1px solid rgba(148,163,184,.16);border-radius:24px;background:rgba(15,23,42,.7);padding:20px}
#solmint-related-articles h2{margin:0;color:#fff;font-size:1.25rem;line-height:1.75;font-weight:900}
#solmint-related-articles nav{margin-top:12px}
#solmint-related-articles ul{list-style:none;margin:0;padding:0;border-top:1px solid rgba(148,163,184,.12)}
#solmint-related-articles li{border-bottom:1px solid rgba(148,163,184,.12)}
#solmint-related-articles li:last-child{border-bottom:0}
#solmint-related-articles a{display:block;padding:12px 0;color:#e2e8f0;text-decoration:none;font-size:.95rem;line-height:1.9;font-weight:700}
#solmint-related-articles a:hover{color:#14F195}
@media(min-width:640px){.solmint-related-articles-card{padding:28px}#solmint-related-articles h2{font-size:1.5rem}}
</style>`;

async function loadArticles(env: Record<string, string | undefined>): Promise<ArticleRow[]> {
  const base = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = String(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();
  const endpoint = `${base}/rest/v1/articles?select=title,slug,category,tags,summary,is_draft&is_draft=eq.false&order=published_at.desc&limit=100`;

  try {
    const response = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function onRequest(context: MiddlewareContext): Promise<Response> {
  const pathname = new URL(context.request.url).pathname.replace(/\/+$/, '') || '/';
  if (!TOOL_CONTEXT[pathname]) return context.next();

  const response = await context.next();
  const html = await response.text();
  if (!html) return response;

  const articles = await loadArticles(context.env || {});
  const related = renderRelatedArticles(selectRelatedArticles(articles, pathname));
  if (!related) return response;

  const updatedHtml = html
    .replace('</head>', `${RELATED_STYLES}</head>`)
    .replace('</body>', `${related}</body>`);

  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=UTF-8');
  headers.set('X-Solmint-SSR', 'tool-related-articles-v3');

  return new Response(updatedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
