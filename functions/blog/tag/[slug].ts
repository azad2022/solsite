import { getCanonicalTagSlug } from '../../../src/config/articleTaxonomy';

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

type ArticleRow = {
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

type TagSeo = { title: string; description: string; h1: string; intro: string };

const SITE = 'https://solmint.ir';
const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const SPECIAL_TAG_SLUG = 'mym-kvyn-jdyd';
const SPECIAL_TAG_NAME = 'میم کوین جدید';
const SPECIAL_TAG_SEO: TagSeo = {
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
function isPublished(article: ArticleRow): boolean {
  return !(article.is_draft === true || article.is_draft === 1 || article.is_draft === 'true');
}
function dateLabel(article: ArticleRow): string {
  return String(article.published_at_jalali || article.published_at_gregorian || article.published_at || '').trim();
}
function tagNames(article: ArticleRow): string[] {
  return Array.isArray(article.tags)
    ? article.tags.map(tag => String(tag || '').trim()).filter(Boolean)
    : [];
}
function genericSeo(tagName: string): TagSeo {
  return {
    title: `${tagName} | مقالات، تحلیل‌ها و مطالب مرتبط | سولمینت`,
    description: `مقالات، تحلیل‌ها و مطالب مرتبط با «${tagName}» در سولمینت؛ تازه‌ترین مطالب مرتبط با سولانا، ارز دیجیتال و وب۳.`,
    h1: `${tagName}؛ مقالات و مطالب مرتبط`,
    intro: `در این صفحه مطالب منتشرشده سولمینت درباره «${tagName}» گردآوری می‌شود. مطالب بر اساس انتشار مرتب شده‌اند تا بتوانید جدیدترین تحلیل‌ها، آموزش‌ها و اخبار مرتبط را دنبال کنید.`
  };
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
  const serialized = JSON.stringify(value).replace(/</g, '\\u003c');
  const tag = `<script id="solmint-tag-jsonld" type="application/ld+json">${serialized}</script>`;
  const rx = /<script[^>]*id=["']solmint-tag-jsonld["'][^>]*>[\s\S]*?<\/script>/i;
  return rx.test(html) ? html.replace(rx, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}
function injectShell(html: string, shell: string): string {
  if (/<div id="solmint-tag-ssr"[\s\S]*?<\/div>/i.test(html)) return html;
  if (/<div id="root"><\/div>/i.test(html)) return html.replace(/<div id="root"><\/div>/i, `<div id="root">${shell}</div>`);
  return html.replace(/<body([^>]*)>/i, `<body$1>${shell}`);
}

export async function onRequest(context: TagContext): Promise<Response> {
  const slug = String(context.params?.slug || '').trim().toLowerCase();
  let baseResponse: Response;
  try {
    baseResponse = await context.next();
  } catch (error) {
    console.error('Tag base route failed:', error);
    return new Response('Tag page temporarily unavailable', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  const baseHeaders = new Headers(baseResponse.headers);
  baseHeaders.set('Content-Type', baseHeaders.get('Content-Type') || 'text/html; charset=UTF-8');

  const supabaseUrl = (context.env?.SUPABASE_URL || context.env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = context.env?.SUPABASE_SECRET_KEY || context.env?.SUPABASE_SERVICE_ROLE_KEY || context.env?.SUPABASE_ANON_KEY || context.env?.VITE_SUPABASE_ANON_KEY;
  if (!key) return new Response(baseResponse.body, { status: baseResponse.status, statusText: baseResponse.statusText, headers: baseHeaders });

  try {
    const select = 'title,slug,summary,cover_image,published_at,published_at_gregorian,published_at_jalali,read_time_minutes,tags,is_draft';
    const response = await fetch(`${supabaseUrl}/rest/v1/articles?select=${select}&is_draft=eq.false&order=published_at.desc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`tag article lookup failed: ${response.status}`);
    const rows = await response.json() as ArticleRow[];
    if (!Array.isArray(rows)) throw new Error('tag article lookup returned non-array data');

    const allPublished = rows.filter(isPublished).filter(article => article.title && article.slug);
    const matching = allPublished.filter(article => tagNames(article).some(tag => getCanonicalTagSlug(tag) === slug));
    const tagName = matching.flatMap(tagNames).find(tag => getCanonicalTagSlug(tag) === slug) || (slug === SPECIAL_TAG_SLUG ? SPECIAL_TAG_NAME : slug);
    const tagSeo = slug === SPECIAL_TAG_SLUG ? SPECIAL_TAG_SEO : genericSeo(tagName);
    const indexable = matching.length > 0;
    const canonical = `${SITE}/blog/tag/${encodeURIComponent(slug)}`;

    const headers = new Headers(baseResponse.headers);
    headers.set('Content-Type', 'text/html; charset=UTF-8');
    headers.set('X-Robots-Tag', indexable ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, follow');
    headers.set('X-Solmint-SEO', `tag-archive-${indexable ? 'indexable' : 'empty'}-v4 count=${matching.length}`);
    headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800');

    let html = await baseResponse.text();
    html = setTitle(html, tagSeo.title);
    html = setMeta(html, 'description', tagSeo.description);
    html = setMeta(html, 'robots', indexable ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, follow');
    html = setProperty(html, 'og:title', tagSeo.title);
    html = setProperty(html, 'og:description', tagSeo.description);
    html = setProperty(html, 'og:type', 'website');
    html = setProperty(html, 'og:url', canonical);
    html = setProperty(html, 'og:site_name', 'سولمینت');
    html = setProperty(html, 'og:locale', 'fa_IR');
    html = setProperty(html, 'og:image', `${SITE}/images/blog-og.jpg`);
    html = setCanonical(html, canonical);

    if (indexable) {
      const shell = `<div id="solmint-tag-ssr" dir="rtl" lang="fa"><nav aria-label="مسیر صفحه"><a href="/">خانه</a> / <a href="/blog">وبلاگ</a> / <span>${escapeHtml(tagName)}</span></nav><main><header><p>آرشیو موضوعی سولمینت</p><h1>${escapeHtml(tagSeo.h1)}</h1><p>${escapeHtml(tagSeo.intro)}</p></header><section aria-labelledby="tag-articles"><h2 id="tag-articles">مقالات مرتبط با «${escapeHtml(tagName)}»</h2><p>${matching.length} مقاله منتشرشده مرتبط با این تگ در آرشیو سولمینت قرار دارد.</p><div class="solmint-tag-grid">${renderCards(matching)}</div></section></main></div>`;
      html = injectShell(html, shell);
    }

    html = setJsonLd(html, indexable ? {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${canonical}#collection`,
      url: canonical,
      name: tagSeo.title,
      headline: tagSeo.h1,
      description: tagSeo.description,
      inLanguage: 'fa-IR',
      isPartOf: { '@type': 'WebSite', '@id': `${SITE}#website`, url: SITE, name: 'سولمینت' },
      breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'خانه', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'وبلاگ', item: `${SITE}/blog` },
        { '@type': 'ListItem', position: 3, name: tagSeo.h1, item: canonical }
      ] },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: matching.length,
        itemListElement: matching.map((article, index) => ({ '@type': 'ListItem', position: index + 1, name: article.title, url: `${SITE}/article/${encodeURIComponent(String(article.slug))}` }))
      }
    } : { '@context': 'https://schema.org', '@type': 'WebPage', url: canonical, name: tagSeo.title, description: tagSeo.description, inLanguage: 'fa-IR' });

    return new Response(html, { status: baseResponse.status, statusText: baseResponse.statusText, headers });
  } catch (error) {
    // Never turn a database/HTML enrichment failure into a Cloudflare 1101. Return the base tag page instead.
    console.error('Tag SEO enrichment failed:', error);
    return new Response(baseResponse.body, { status: baseResponse.status, statusText: baseResponse.statusText, headers: baseHeaders });
  }
}
