import fs from 'node:fs';

function replaceRequired(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Patch target not found: ${label}`);
  return next;
}

const articlePath = 'functions/article/[slug].ts';
let article = fs.readFileSync(articlePath, 'utf8');

article = replaceRequired(
  article,
  /  const env = context\.env \|\| \{\}; const base = \(env\.SUPABASE_URL \|\| DEFAULT_SUPABASE_URL\)\.replace\(\/\\\\\/$\/, ''\); const key = String\(env\.SUPABASE_ANON_KEY \|\| env\.VITE_SUPABASE_ANON_KEY \|\| ''\)\.trim\(\); if \(!key\) return context\.next\(\);/,
  `  const env = context.env || {};
  const base = (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\\/$/, '');
  // Server-only credentials are preferred. The public key is the final fallback because it is
  // already shipped to browser clients and therefore contains no server secret.
  const key = String(
    env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_XaeRMCeIhR7-Zwq6YhdkVw_cOwO9OLt'
  ).trim();`,
  'Supabase SSR key block'
);

article = replaceRequired(
  article,
  /function setDocumentLanguage\(html: string, lang: string, dir: string\) \{[\s\S]*?\}\n/,
  `function setDocumentLanguage(html: string, lang: string, dir: string) { return html.replace(/<html\\b[^>]*>/i, \`<html lang=\\\"\${lang}\\\" dir=\\\"\${dir}\\\">\`); }
function setArticleBootstrap(html: string, article: ArticleRecord) {
  const payload = JSON.stringify(article).replace(/</g, '\\\\u003c');
  const tag = \`<script id=\"solmint-article-bootstrap\" type=\"application/json\">\${payload}</script>\`;
  const rx = /<script[^>]*id=[\"']solmint-article-bootstrap[\"'][^>]*>[\\s\\S]*?<\\/script>/i;
  return rx.test(html) ? html.replace(rx, tag) : html.replace('</head>', \`    \${tag}\\n  </head>\`);
}
`,
  'article bootstrap helper'
);

article = replaceRequired(
  article,
  /  let result = html; result = setDocumentLanguage\(result, locale\.lang, locale\.dir\); result = setTitle\(result, title\); result = setCanonical\(result, canonical\); result = setMeta\(result, 'description', description\);/,
  "  let result = html; result = setDocumentLanguage(result, locale.lang, locale.dir); result = setArticleBootstrap(result, article); result = setTitle(result, title); result = setCanonical(result, canonical); result = setMeta(result, 'description', description);",
  'article bootstrap injection'
);

article = replaceRequired(
  article,
  /export async function onRequest\(context: PageContext\): Promise<Response> \{[\s\S]*?\n\}/,
  `export async function onRequest(context: PageContext): Promise<Response> {
  const slug = decodeURIComponent(String(context.params.slug || '')).trim();
  if (!slug || slug.length > 200) return context.next();
  if (slug === 'solana-price-live-today') return Response.redirect(\`${'${SITE_ORIGIN}'}/solana-price\`, 301);

  const env = context.env || {};
  const base = (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\\/$/, '');
  const key = String(
    env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_XaeRMCeIhR7-Zwq6YhdkVw_cOwO9OLt'
  ).trim();

  const endpoint = \`${'${base}'}/rest/v1/articles?select=id,title,slug,category,category_id,tags,summary,content,cover_image,author,published_at,published_at_jalali,published_at_gregorian,updated_at,read_time_minutes,is_draft&slug=eq.${'${encodeURIComponent(slug)}'}&is_draft=eq.false&limit=1\`;

  const unavailable = (status = 503) => new Response(
    status === 404 ? 'Article not found' : 'Article rendering temporarily unavailable',
    {
      status,
      headers: {
        'Content-Type': 'text/plain; charset=UTF-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Retry-After': status === 503 ? '60' : '0',
        'X-Robots-Tag': status === 404 ? 'noindex, follow' : 'noindex, follow',
        'X-Solmint-SSR': 'article-seo-v4'
      }
    }
  );

  if (!key) return unavailable(503);

  try {
    const upstream = await fetch(endpoint, {
      headers: { apikey: key, Authorization: \`Bearer \${key}\`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (!upstream.ok) return unavailable(503);

    const rows = await upstream.json() as ArticleRecord[];
    const article = rows[0];
    if (!article) return unavailable(404);

    const [related, shellResponse] = await Promise.all([fetchRelated(base, key, article), context.next()]);
    if (!shellResponse.ok || !(shellResponse.headers.get('Content-Type') || '').toLowerCase().includes('text/html')) return unavailable(503);

    let html = await shellResponse.text();
    if (!/<div id="root"><\\/div>/i.test(html)) {
      const originResponse = await fetch(new URL('/', context.request.url), { headers: { Accept: 'text/html' } });
      if (!originResponse.ok || !(originResponse.headers.get('Content-Type') || '').toLowerCase().includes('text/html')) return unavailable(503);
      html = await originResponse.text();
    }

    const headers = new Headers(shellResponse.headers);
    headers.set('Content-Type', 'text/html; charset=UTF-8');
    headers.set('X-Robots-Tag', 'index, follow');
    headers.set('X-Solmint-SSR', 'article-seo-v4');
    headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');
    if (article.updated_at) headers.set('Last-Modified', new Date(article.updated_at).toUTCString());

    return new Response(inject(html, article, related), { status: 200, headers });
  } catch (error) {
    console.error('[article-ssr] failed to render article:', error);
    return unavailable(503);
  }
}`,
  'article SSR request handler'
);

fs.writeFileSync(articlePath, article);

const appPath = 'src/App.tsx';
let app = fs.readFileSync(appPath, 'utf8');
app = replaceRequired(
  app,
  /  const \[articles, setArticles\] = useState<Article\[\]>\(\(\) => safeGetLocalStorage<Article\[\]>\('solmint_articles', INITIAL_ARTICLES\)\);/,
  `  const [articles, setArticles] = useState<Article[]>(() => {
    const stored = safeGetLocalStorage<Article[]>('solmint_articles', INITIAL_ARTICLES);
    if (typeof document === 'undefined') return stored;
    try {
      const bootstrap = document.getElementById('solmint-article-bootstrap');
      const raw = bootstrap?.textContent?.trim();
      if (!raw) return stored;
      const article = JSON.parse(raw) as Article;
      if (!article?.slug || !article?.title) return stored;
      return [article, ...stored.filter(item => item.slug !== article.slug)];
    } catch {
      return stored;
    }
  });`,
  'App article bootstrap state'
);
fs.writeFileSync(appPath, app);

const mainPath = 'src/main.tsx';
let main = fs.readFileSync(mainPath, 'utf8');
const oldBoundary = /  render\(\) \{\n    if \(!this\.state\.hasError\) return this\.childContent;\n    return \(\n      <div dir="rtl"[\s\S]*?      \);\n  \}/;
const newBoundary = `  render() {
    if (!this.state.hasError) return this.childContent;

    // Preserve a crawlable article experience even when a client-side component crashes.
    // The article SSR function injects the canonical record before React mounts.
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/article/')) {
      try {
        const raw = document.getElementById('solmint-article-bootstrap')?.textContent?.trim();
        const article = raw ? JSON.parse(raw) : null;
        if (article?.title && article?.content) {
          return (
            <main dir="rtl" style={{ minHeight: '100vh', background: '#08080f', color: '#e2e8f0', padding: '32px 20px', fontFamily: 'Vazirmatn, sans-serif' }}>
              <article style={{ width: '100%', maxWidth: 900, margin: '0 auto' }}>
                <nav aria-label="مسیر صفحه" style={{ color: '#94a3b8', marginBottom: 24 }}>
                  <a href="/" style={{ color: '#38bdf8' }}>سولمینت</a> / <a href="/blog" style={{ color: '#38bdf8' }}>وبلاگ</a> / {article.title}
                </nav>
                <h1 style={{ fontSize: 32, lineHeight: 1.4, color: '#fff', marginBottom: 16 }}>{article.title}</h1>
                {article.summary && <p style={{ color: '#cbd5e1', lineHeight: 1.9 }}>{article.summary}</p>}
                <section aria-label="متن مقاله" style={{ marginTop: 28, whiteSpace: 'pre-wrap', lineHeight: 2 }}>{article.content}</section>
              </article>
            </main>
          );
        }
      } catch {}
    }

    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: '#08080f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Vazirmatn, sans-serif', textAlign: 'center' }}>
        <section style={{ width: '100%', maxWidth: 560, padding: 32, borderRadius: 24, background: '#11111f', border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 24px 60px rgba(0,0,0,.45)' }}>
          <h1 style={{ color: '#14F195', fontSize: 22, margin: '0 0 12px', fontWeight: 800 }}>خطا در بارگذاری صفحه</h1>
          <p style={{ color: '#94a3b8', lineHeight: 1.9, margin: '0 0 20px' }}>اجرای رابط کاربری با خطا متوقف شد. این خطا ثبت شده و صفحه می‌تواند دوباره بارگذاری شود.</p>
          <button type="button" onClick={this.handleReload} style={{ border: 0, borderRadius: 12, padding: '11px 22px', background: '#9945FF', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>بارگذاری مجدد</button>
          {import.meta.env.DEV && this.state.errorMessage && <pre style={{ marginTop: 20, color: '#fca5a5', whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left' }}>{this.state.errorMessage}</pre>}
        </section>
      </div>
    );
  }`;
main = replaceRequired(main, oldBoundary, newBoundary, 'React ErrorBoundary article fallback');
fs.writeFileSync(mainPath, main);

const serverPath = 'server.ts';
let server = fs.readFileSync(serverPath, 'utf8');
server = replaceRequired(server, 'deleteArticleFromDisk(articleId);', 'deleteArticleFromDisk(String(articleId));', 'server.ts article id type fix');
fs.writeFileSync(serverPath, server);

console.log('Article SEO runtime repair applied successfully.');
