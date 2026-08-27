type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

type ArticleRow = {
  id?: string | null;
  title?: string | null;
  slug?: string | null;
  summary?: string | null;
  cover_image?: string | null;
  published_at?: string | null;
  published_at_gregorian?: string | null;
  published_at_jalali?: string | null;
  read_time_minutes?: number | string | null;
  tags?: unknown;
  is_draft?: boolean | number | string | null;
};

type TagContext = {
  request: Request;
  next: () => Promise<Response>;
  params: { slug: string };
  env?: Env;
};

type TagSeoConfig = {
  title: string;
  description: string;
  h1: string;
  intro: string;
};

const SITE = 'https://solmint.ir';
const TARGET_SLUG = 'mym-kvyn-jdyd';
const TARGET_TAG = 'میم کوین جدید';
const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

// Keep the one intentionally indexable editorial tag self-contained at the route boundary.
// This avoids importing build-time taxonomy exports that may not exist in a fresh Functions bundle.
const TARGET_TAG_SEO: TagSeoConfig = {
  title: 'میم کوین جدید | جدیدترین میم کوین‌های سولانا و بازار کریپتو | سولمینت',
  description: 'جدیدترین میم کوین‌های سولانا و بازار کریپتو را در سولمینت دنبال کنید؛ پوشش پروژه‌های تازه، میم‌کوین‌های ترند، داده‌های بازار، ریسک‌ها و بررسی‌های به‌روز.',
  h1: 'میم کوین جدید؛ جدیدترین میم‌کوین‌های سولانا و بازار کریپتو',
  intro: 'این صفحه مرجع پوشش «میم کوین جدید» در سولمینت است؛ مقاله‌های مرتبط با میم‌کوین‌های تازه‌وارد، پروژه‌های تازه‌فعال‌شده و موج‌های جدید بازار را یکجا دنبال کنید. تمرکز مطالب بر اطلاعات قابل بررسی، وضعیت بازار، نقدینگی، حجم، سابقه پروژه و ریسک‌های مهم است و محتوای این صفحه توصیه خرید یا فروش نیست.'
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
}
function safeUrl(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, SITE);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch { return ''; }
}
function setTitle(html: string, title: string): string {
  const tag = `<title>${escapeHtml(title)}</title>`;
  return /<title>[\s\S]*?<\/title>/i.test(html) ? html.replace(/<title>[\s\S]*?<\/title>/i, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}
function setMeta(html: string, name: string, content: string): string {
  const tag = `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}">`;
  const rx = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, 'i');
  return rx.test(html) ? html.replace(rx, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}
function setProperty(html: string, property: string, content: string): string {
  const tag = `<meta property="${escapeHtml(property)}" content="${escapeHtml(content)}">`;
  const rx = new RegExp(`<meta\\s+property=["']${property}["'][^>]*>`, 'i');
  return rx.test(html) ? html.replace(rx, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}
function setCanonical(html: string, canonical: string): string {
  const tag = `<link rel="canonical" href="${escapeHtml(canonical)}">`;
  const rx = /<link\s+rel=["']canonical["'][^>]*>/i;
  return rx.test(html) ? html.replace(rx, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}
function setJsonLd(html: string, value: unknown): string {
  const tag = `<script id="solmint-tag-jsonld" type="application/ld+json">${JSON.stringify(value).replace(/</g, '\\u003c')}</script>`;
  const rx = /<script[^>]*id=["']solmint-tag-jsonld["'][^>]*>[\s\S]*?<\/script>/i;
  return rx.test(html) ? html.replace(rx, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}
function isPublished(article: ArticleRow): boolean {
  return !(article.is_draft === true || article.is_draft === 1 || article.is_draft === 'true');
}
function dateLabel(article: ArticleRow): string {
  return String(article.published_at_jalali || article.published_at_gregorian || article.published_at || '').trim();
}
function renderCards(articles: ArticleRow[]): string {
  return articles.map(article => {
    const slug = encodeURIComponent(String(article.slug || '').trim());
    const title = String(article.title || '').trim();
    const summary = String(article.summary || '').trim();
    const image = safeUrl(article.cover_image);
    const readTime = Number(article.read_time_minutes || 0);
    return `<article class="solmint-tag-card"><a class="solmint-tag-card-link" href="/article/${slug}">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">` : ''}<div><time>${escapeHtml(dateLabel(article))}</time><h2>${escapeHtml(title)}</h2><p>${escapeHtml(summary)}</p><span>${readTime > 0 ? `${readTime} دقیقه مطالعه` : 'مطالعه مقاله'} ←</span></div></a></article>`;
  }).join('');
}
async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return null; }
}

export async function onRequest(context: TagContext): Promise<Response> {
  const slug = String(context.params?.slug || '').trim().toLowerCase();
  const tagConfig = slug === TARGET_SLUG ? TARGET_TAG_SEO : null;
  if (!tagConfig) {
    const response = await context.next();
    const headers = new Headers(response.headers);
    headers.set('X-Robots-Tag', 'noindex, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
    headers.set('X-Solmint-SEO', 'tag-archive-noindex-v1');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  const supabaseUrl = (context.env?.SUPABASE_URL || context.env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = context.env?.SUPABASE_SECRET_KEY || context.env?.SUPABASE_SERVICE_ROLE_KEY || context.env?.SUPABASE_ANON_KEY || context.env?.VITE_SUPABASE_ANON_KEY;
  if (!key) {
    console.error('Tag SEO configuration error: Supabase key is missing');
    const fallback = await context.next();
    const headers = new Headers(fallback.headers);
    headers.set('X-Robots-Tag', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
    headers.set('X-Solmint-SEO', 'tag-archive-indexable-v3-fallback');
    return new Response(fallback.body, { status: fallback.status, statusText: fallback.statusText, headers });
  }
  const authHeaders = { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' };
  const canonical = `${SITE}/blog/tag/${TARGET_SLUG}`;

  try {
    const select = 'id,title,slug,summary,cover_image,published_at,published_at_gregorian,published_at_jalali,read_time_minutes,tags,is_draft';
    const filter = encodeURIComponent(`{\"${TARGET_TAG}\"}`);
    const response = await fetch(`${supabaseUrl}/rest/v1/articles?select=${select}&tags=cs.${filter}&is_draft=eq.false&order=published_at.desc`, { headers: authHeaders, cache: 'no-store' });
    if (!response.ok) throw new Error(`tag article lookup failed: ${response.status}`);
    const rows = await readJson(response) as ArticleRow[];
    const articles = (Array.isArray(rows) ? rows : []).filter(isPublished).filter(article => article.title && article.slug);
    const baseResponse = await context.next();
    const headers = new Headers(baseResponse.headers);
    headers.set('Content-Type', 'text/html; charset=UTF-8');
    headers.set('X-Robots-Tag', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
    headers.set('X-Solmint-SEO', `tag-archive-indexable-v3 count=${articles.length}`);
    headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800');
    if (!baseResponse.ok) return new Response(baseResponse.body, { status: baseResponse.status, headers });

    let html = await baseResponse.text();
    html = setTitle(html, tagConfig.title);
    html = setMeta(html, 'description', tagConfig.description);
    html = setMeta(html, 'robots', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
    html = setProperty(html, 'og:title', tagConfig.title);
    html = setProperty(html, 'og:description', tagConfig.description);
    html = setProperty(html, 'og:type', 'website');
    html = setProperty(html, 'og:url', canonical);
    html = setProperty(html, 'og:site_name', 'سولمینت');
    html = setProperty(html, 'og:locale', 'fa_IR');
    html = setProperty(html, 'og:image', `${SITE}/images/blog-og.jpg`);
    html = setCanonical(html, canonical);

    const cards = renderCards(articles);
    const shell = `<div id="solmint-tag-ssr" dir="rtl" lang="fa"><nav aria-label="مسیر صفحه"><a href="/">خانه</a> / <a href="/blog">وبلاگ</a> / <span>${escapeHtml(TARGET_TAG)}</span></nav><main><header><p>مرجع تازه‌ترین میم‌کوین‌ها</p><h1>${escapeHtml(tagConfig.h1)}</h1><p>${escapeHtml(tagConfig.intro)}</p></header><section aria-labelledby="new-meme-coin-articles"><h2 id="new-meme-coin-articles">مقالات مرتبط با میم کوین جدید</h2><p>در حال حاضر ${articles.length} مقاله منتشرشده در این موضوع قرار دارد و با انتشار مطالب جدید، این صفحه به‌روزرسانی می‌شود.</p><div class="solmint-tag-grid">${cards}</div></section><section aria-labelledby="how-to-evaluate-new-memecoins"><h2 id="how-to-evaluate-new-memecoins">چطور یک میم کوین جدید را بررسی کنیم؟</h2><p>تازه‌بودن به‌تنهایی نشانه کیفیت نیست. برای بررسی یک میم‌کوین جدید، سن توکن، نقدینگی، حجم معاملات، توزیع هولدرها، وضعیت قرارداد و اختیارهای مدیریتی، سابقه توسعه‌دهندگان و رفتار بازار را جداگانه بررسی کنید.</p><p>در بازار میم‌کوین‌ها، نقدینگی پایین و رشد ناگهانی می‌تواند خروج از معامله را دشوار کند. اطلاعات هر پروژه ممکن است سریع تغییر کند؛ داده‌های بازار و منابع اولیه را پیش از هر تصمیم بررسی کنید.</p></section><section aria-labelledby="meme-coin-new-faq"><h2 id="meme-coin-new-faq">سوالات متداول درباره میم کوین جدید</h2><h3>میم کوین جدید یعنی چه؟</h3><p>به توکن‌های میم‌محوری که به‌تازگی راه‌اندازی شده‌اند یا تازه در بازار مورد توجه قرار گرفته‌اند، معمولاً میم‌کوین جدید گفته می‌شود.</p><h3>جدیدترین میم کوین‌های سولانا را کجا دنبال کنیم؟</h3><p>در این صفحه مقالات جدید سولمینت درباره پروژه‌های تازه و ترند سولانا به‌ترتیب انتشار جمع‌آوری می‌شوند.</p><h3>آیا هر میم کوین جدیدی ارزش خرید دارد؟</h3><p>خیر. جدیدبودن هیچ تضمینی درباره کیفیت، نقدینگی یا آینده یک پروژه نیست و این صفحه توصیه سرمایه‌گذاری ارائه نمی‌کند.</p></section></main></div>`;
    if (/<div id="root"><\/div>/i.test(html)) html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${shell}</div>`);
    else if (!html.includes('id="solmint-tag-ssr"')) html = html.replace(/<body([^>]*)>/i, `<body$1>${shell}`);

    html = setJsonLd(html, {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${canonical}#collection`,
      url: canonical,
      name: tagConfig.title,
      headline: tagConfig.h1,
      description: tagConfig.description,
      inLanguage: 'fa-IR',
      isPartOf: { '@type': 'WebSite', '@id': `${SITE}#website`, url: SITE, name: 'سولمینت' },
      about: { '@type': 'Thing', name: 'New meme coins on Solana' },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: articles.length,
        itemListElement: articles.map((article, index) => ({ '@type': 'ListItem', position: index + 1, name: article.title, url: `${SITE}/article/${encodeURIComponent(String(article.slug))}` }))
      },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'خانه', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'وبلاگ', item: `${SITE}/blog` },
          { '@type': 'ListItem', position: 3, name: tagConfig.h1, item: canonical }
        ]
      }
    });

    return new Response(html, { status: baseResponse.status, headers });
  } catch (error) {
    console.error('New meme coin tag SSR failed:', error);
    try {
      const fallback = await context.next();
      const headers = new Headers(fallback.headers);
      headers.set('X-Robots-Tag', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
      headers.set('X-Solmint-SEO', 'tag-archive-indexable-v3-fallback');
      return new Response(fallback.body, { status: fallback.status, statusText: fallback.statusText, headers });
    } catch (fallbackError) {
      console.error('Tag fallback failed:', fallbackError);
      return new Response('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>میم کوین جدید | سولمینت</title><meta name="robots" content="index, follow"></head><body><main><h1>میم کوین جدید؛ جدیدترین میم‌کوین‌های سولانا و بازار کریپتو</h1><p>این صفحه موقتاً با نسخه پایه نمایش داده می‌شود.</p></main></body></html>', { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'X-Robots-Tag': 'index, follow', 'X-Solmint-SEO': 'tag-archive-hard-fallback-v3' } });
    }
  }
}
