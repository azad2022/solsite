type ArticleRow = {
  title?: string | null;
  slug?: string | null;
  category?: string | null;
  tags?: string[] | null;
  summary?: string | null;
  is_draft?: boolean | null;
};

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type PageContext = {
  request: Request;
  next: () => Promise<Response>;
  env?: Env;
};

const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

const TOOL_KEYWORDS: Record<string, string[]> = {
  '/tools/solana-token-tools': ['سولانا', 'توکن', 'token-2022', 'spl token', 'mint', 'authority', 'امنیت'],
  '/tools/solana-token-scanner': ['سولانا', 'توکن', 'token-2022', 'mint', 'mint authority', 'freeze authority', 'tokenomics', 'امنیت'],
  '/tools/token-2022-inspector': ['token-2022', 'سولانا', 'توکن', 'spl token', 'extension', 'transfer fee', 'transfer hook'],
};

function normalize(value: unknown) {
  return String(value ?? '').toLocaleLowerCase('fa-IR').replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function score(article: ArticleRow, keywords: string[]) {
  const text = normalize(`${article.title} ${article.summary} ${(article.tags || []).join(' ')} ${article.category}`);
  return keywords.reduce((total, keyword) => total + (text.includes(normalize(keyword)) ? (keyword.length > 8 ? 4 : 2) : 0), 0);
}

function renderRelated(articles: ArticleRow[], pathname: string) {
  const keywords = TOOL_KEYWORDS[pathname];
  if (!keywords) return '';

  const related = articles
    .filter(article => !article.is_draft && article.slug && article.title)
    .map(article => ({ article, score: score(article, keywords) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(item => item.article);

  if (!related.length) return '';

  const items = related.map(article => {
    const slug = String(article.slug).replace(/^\/+|\/+$/g, '');
    return `<li><a href="/article/${encodeURIComponent(slug)}">${escapeHtml(article.title)}</a></li>`;
  }).join('');

  return `<section id="tool-related-articles" dir="rtl" aria-labelledby="tool-related-articles-title"><div class="tool-related-inner"><h2 id="tool-related-articles-title">مقالات مرتبط</h2><ul>${items}</ul></div></section>`;
}

function inject(html: string, section: string) {
  if (!section) return html;
  const style = `<style id="tool-related-articles-style">#tool-related-articles{max-width:1152px;margin:0 auto;padding:0 16px 48px}#tool-related-articles .tool-related-inner{border:1px solid rgba(148,163,184,.16);border-radius:24px;background:rgba(15,23,42,.72);padding:20px 24px}#tool-related-articles h2{margin:0;color:#fff;font-size:22px;font-weight:900}#tool-related-articles ul{list-style:none;margin:14px 0 0;padding:0;border-top:1px solid rgba(148,163,184,.12)}#tool-related-articles li{border-bottom:1px solid rgba(148,163,184,.12)}#tool-related-articles li:last-child{border-bottom:0}#tool-related-articles a{display:block;padding:12px 0;color:#e2e8f0;text-decoration:none;font-size:15px;font-weight:700;line-height:1.8}#tool-related-articles a:hover{color:#14F195}@media(min-width:640px){#tool-related-articles .tool-related-inner{padding:28px}}</style>`;
  const styled = html.includes('</head>') ? html.replace('</head>', `${style}</head>`) : html;
  if (styled.includes('id="tool-related-articles"')) return styled;
  return styled.includes('</body>') ? styled.replace(/<\/body>/i, `${section}</body>`) : `${styled}${section}`;
}

export async function onRequest(context: PageContext): Promise<Response> {
  const pathname = new URL(context.request.url).pathname.replace(/\/+$/, '') || '/';
  if (!TOOL_KEYWORDS[pathname]) return context.next();

  const upstream = await context.next();
  if (!upstream.ok) return upstream;

  let html: string;
  try {
    html = await upstream.text();
  } catch {
    return upstream;
  }
  if (!html || !/<html[\s>]/i.test(html)) return new Response(html, upstream);

  let articles: ArticleRow[] = [];
  try {
    const env = context.env || {};
    const base = (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
    const key = String(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!key) return new Response(html, upstream);

    const endpoint = `${base}/rest/v1/articles?select=title,slug,category,tags,summary,is_draft&is_draft=eq.false&order=created_at.desc&limit=100`;
    const response = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
    if (!response.ok) return new Response(html, upstream);
    const payload = await response.json();
    articles = Array.isArray(payload) ? payload : [];
  } catch {
    return new Response(html, upstream);
  }

  const section = renderRelated(articles, pathname);
  if (!section) return new Response(html, upstream);

  const headers = new Headers(upstream.headers);
  headers.delete('content-length');
  headers.set('Content-Type', 'text/html; charset=UTF-8');
  headers.set('X-Solmint-SSR', 'tool-related-articles-v4');
  return new Response(inject(html, section), { status: upstream.status, statusText: upstream.statusText, headers });
}
