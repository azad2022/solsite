type ArticleRecord = {
  title: string;
  slug: string;
  summary?: string | null;
  cover_image?: string | null;
  category?: string | null;
  published_at?: string | null;
  published_at_jalali?: string | null;
  read_time_minutes?: number | null;
  is_draft?: boolean | null;
};

type PageContext = { request: Request; next: () => Promise<Response>; env?: Record<string, string | undefined> };

const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_XaeRMCeIhR7-ZwqYhdkVw_cOwO9OLt';
const SITE_ORIGIN = 'https://solmint.ir';

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function safeImage(value: unknown) {
  const raw = String(value || '').trim();
  return /^(https?:|\/)/i.test(raw) && !/^(javascript|data|vbscript):/i.test(raw) ? raw : `${SITE_ORIGIN}/images/blog-og.jpg`;
}

function articleHref(slug: string) {
  return `/article/${encodeURIComponent(slug)}`;
}

function renderArticleLinks(articles: ArticleRecord[]) {
  if (!articles.length) {
    return '<p class="blog-ssr-empty">مقالات منتشرشده‌ای برای نمایش پیدا نشد.</p>';
  }

  return `<section id="blog-ssr-index" aria-labelledby="blog-ssr-index-title">\
<h2 id="blog-ssr-index-title">آخرین مقالات سولمینت</h2>\
<div class="blog-ssr-grid">${articles.map(article => {\
    const title = esc(article.title);\
    const href = esc(articleHref(article.slug));\
    const summary = esc(stripHtml(String(article.summary || '')));\
    const category = esc(article.category || 'مقاله');\
    const date = esc(article.published_at_jalali || article.published_at || '');\
    const image = esc(safeImage(article.cover_image));\
    const readTime = esc(article.read_time_minutes || 5);\
    return `<article class="blog-ssr-card"><a href="${href}"><img src="${image}" alt="${title}" loading="lazy" decoding="async"><div><p class="blog-ssr-category">${category}</p><h3>${title}</h3>${summary ? `<p>${summary}</p>` : ''}<small>${date}${date ? ' · ' : ''}${readTime} دقیقه مطالعه</small></div></a></article>`;
  }).join('')}</div>\
</section>`;
}

function inject(html: string, articles: ArticleRecord[]) {
  const title = 'وبلاگ و آکادمی آموزشی سولمینت | آموزش وب۳، سولانا و کریپتو';
  const description = 'مقالات تخصصی و آموزش‌های جامع سولانا، ساخت توکن، مدیریت کیف پول غیرامانی، امنیت کریپتو و اخبار تحلیلی شبکه سولانا در آکادمی سولمینت.';
  const canonical = `${SITE_ORIGIN}/blog`;
  const style = `<style id="blog-ssr-style">#blog-ssr-index{max-width:1200px;margin:0 auto;padding:24px 16px 56px;direction:rtl}#blog-ssr-index-title{font-size:24px;font-weight:900;color:#fff;margin:0 0 20px}.blog-ssr-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.blog-ssr-card{border:1px solid rgba(148,163,184,.16);border-radius:20px;overflow:hidden;background:rgba(15,23,42,.72)}.blog-ssr-card a{display:block;color:inherit;text-decoration:none}.blog-ssr-card img{width:100%;height:170px;object-fit:cover}.blog-ssr-card div{padding:16px}.blog-ssr-category{font-size:11px;color:#94a3b8;margin:0 0 8px}.blog-ssr-card h3{font-size:16px;line-height:1.7;margin:0;color:#fff}.blog-ssr-card p:not(.blog-ssr-category){font-size:12px;line-height:1.9;color:#94a3b8;margin:8px 0 0}.blog-ssr-card small{display:block;font-size:11px;color:#64748b;margin-top:10px}.blog-ssr-empty{color:#94a3b8}.blog-ssr-noscript{max-width:1200px;margin:0 auto;padding:0 16px}@media(max-width:800px){.blog-ssr-grid{grid-template-columns:1fr}}@media(min-width:801px) and (max-width:1050px){.blog-ssr-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>`;
  const head = `<!-- SolMint blog SSR -->`;
  let result = html;
  result = result.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  result = result.replace('</head>', `${style}<meta name="description" content="${esc(description)}"><meta name="robots" content="index, follow"><link rel="canonical" href="${esc(canonical)}">${head}</head>`);
  result = result.replace(/<div id="root"><\/div>/i, `<div id="root">${renderArticleLinks(articles)}</div>`);
  return result;
}

export async function onRequest(context: PageContext): Promise<Response> {
  const env = context.env || {};
  const base = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = String(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();

  let articles: ArticleRecord[] = [];
  try {
    const endpoint = `${base}/rest/v1/articles?select=title,slug,summary,cover_image,category,published_at,published_at_jalali,read_time_minutes,is_draft&is_draft=eq.false&order=published_at.desc&limit=50`;
    const response = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } });
    if (response.ok) {
      const rows = await response.json();
      articles = Array.isArray(rows) ? rows.filter((row: ArticleRecord) => row.slug && !row.is_draft) : [];
    }
  } catch {
    // Fall back to the normal SPA shell during a temporary database failure.
  }

  const upstream = await context.next();
  const html = await upstream.text();
  if (!html) return upstream;

  const headers = new Headers(upstream.headers);
  headers.set('Content-Type', 'text/html; charset=UTF-8');
  headers.set('X-Solmint-SSR', 'blog-discovery-v1');
  headers.set('X-Robots-Tag', 'index, follow');
  return new Response(inject(html, articles), { status: upstream.status, headers });
}
