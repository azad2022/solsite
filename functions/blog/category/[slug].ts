import { CATEGORY_SEO, findCategoryNameBySlug } from '../../../src/config/articleTaxonomy';

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
  category_id?: string | null;
  is_draft?: boolean | number | string | null;
};

type CategoryRow = { id?: string | null; name?: string | null; slug?: string | null; is_active?: boolean | null };

const SITE = 'https://solmint.ir';
const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, SITE);
    return url.protocol === 'https:' && url.hostname === new URL(SITE).hostname ? url.toString() : '';
  } catch { return ''; }
}

function isPublished(article: ArticleRow): boolean {
  return !(article.is_draft === true || article.is_draft === 1 || article.is_draft === 'true');
}

function dateLabel(article: ArticleRow): string {
  return String(article.published_at_jalali || article.published_at_gregorian || article.published_at || '').trim();
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
  const tag = `<script id="solmint-taxonomy-ssr-jsonld" type="application/ld+json">${JSON.stringify(value).replace(/</g, '\\u003c')}</script>`;
  const rx = /<script[^>]*id=["']solmint-taxonomy-ssr-jsonld["'][^>]*>[\s\S]*?<\/script>/i;
  return rx.test(html) ? html.replace(rx, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

function setBootstrap(html: string, value: unknown): string {
  const tag = `<script id="solmint-taxonomy-bootstrap" type="application/json">${JSON.stringify(value).replace(/</g, '\\u003c')}</script>`;
  const rx = /<script[^>]*id=["']solmint-taxonomy-bootstrap["'][^>]*>[\s\S]*?<\/script>/i;
  return rx.test(html) ? html.replace(rx, tag) : html.replace('</body>', `${tag}\n</body>`);
}

function renderCards(articles: ArticleRow[]): string {
  return articles.map(article => {
    const slug = encodeURIComponent(String(article.slug || '').trim());
    const title = String(article.title || '').trim();
    const summary = String(article.summary || '').trim();
    const image = safeUrl(article.cover_image);
    const readTime = Number(article.read_time_minutes || 0);
    const date = dateLabel(article);
    return `<article class="solmint-taxonomy-card"><a class="solmint-taxonomy-card-link" href="/article/${slug}">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">` : ''}<div class="solmint-taxonomy-card-body"><time>${escapeHtml(date)}</time><h2>${escapeHtml(title)}</h2><p>${escapeHtml(summary)}</p><span>${readTime > 0 ? `${readTime} دقیقه مطالعه` : 'مطالعه مقاله'} ←</span></div></a></article>`;
  }).join('');
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return null; }
}

export const onRequest = async (context: { request: Request; env?: Env; next: () => Promise<Response> }): Promise<Response> => {
  const requestUrl = new URL(context.request.url);
  const rawSlug = decodeURIComponent(requestUrl.pathname.split('/').filter(Boolean).pop() || '').toLowerCase();
  const categoryName = findCategoryNameBySlug(rawSlug);
  const seo = CATEGORY_SEO[rawSlug];
  if (!categoryName || !seo) return context.next();

  let baseResponse: Response;
  try {
    baseResponse = await context.next();
  } catch (error) {
    console.error('Category base route failed:', error);
    return new Response('Category page temporarily unavailable', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  const baseHeaders = new Headers(baseResponse.headers);
  baseHeaders.set('Content-Type', baseHeaders.get('Content-Type') || 'text/html; charset=UTF-8');

  const supabaseUrl = (context.env?.SUPABASE_URL || context.env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = context.env?.SUPABASE_SECRET_KEY || context.env?.SUPABASE_SERVICE_ROLE_KEY || context.env?.SUPABASE_ANON_KEY || context.env?.VITE_SUPABASE_ANON_KEY;
  if (!key) return new Response(baseResponse.body, { status: baseResponse.status, statusText: baseResponse.statusText, headers: baseHeaders });

  const authHeaders = { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' };

  try {
    const categoryResponse = await fetch(`${supabaseUrl}/rest/v1/article_categories?select=id,name,slug,is_active&name=eq.${encodeURIComponent(categoryName)}&limit=1`, { headers: authHeaders, cache: 'no-store' });
    if (!categoryResponse.ok) throw new Error(`category lookup failed: ${categoryResponse.status}`);
    const categoryRows = await readJson(categoryResponse) as CategoryRow[];
    const categoryId = Array.isArray(categoryRows) && categoryRows[0]?.id ? String(categoryRows[0].id) : '';
    if (!categoryId) {
      console.error('Configured category missing from database:', rawSlug);
      return new Response(baseResponse.body, { status: baseResponse.status, statusText: baseResponse.statusText, headers: baseHeaders });
    }

    const articleSelect = 'id,title,slug,summary,cover_image,published_at,published_at_gregorian,published_at_jalali,read_time_minutes,tags,category_id,is_draft';
    const articleResponse = await fetch(`${supabaseUrl}/rest/v1/articles?select=${articleSelect}&category_id=eq.${encodeURIComponent(categoryId)}&is_draft=eq.false&order=published_at.desc`, { headers: authHeaders, cache: 'no-store' });
    if (!articleResponse.ok) throw new Error(`article lookup failed: ${articleResponse.status}`);
    const rows = await readJson(articleResponse) as ArticleRow[];
    const articles = (Array.isArray(rows) ? rows : []).filter(isPublished).filter(article => article.title && article.slug);

    const canonical = `${SITE}/blog/category/${rawSlug}`;
    const headers = new Headers(baseResponse.headers);
    headers.set('Content-Type', 'text/html; charset=UTF-8');
    const indexable = articles.length >= 2;
    headers.set('X-Robots-Tag', indexable ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, follow');
    headers.set('X-Solmint-SEO', `taxonomy-ssr-v3 category=${rawSlug} count=${articles.length}`);
    headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800');

    if (!baseResponse.ok) return new Response(baseResponse.body, { status: baseResponse.status, headers });

    let html = await baseResponse.text();
    html = setTitle(html, seo.title);
    html = setMeta(html, 'description', seo.description);
    html = setMeta(html, 'robots', indexable ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, follow');
    html = setProperty(html, 'og:title', seo.title);
    html = setProperty(html, 'og:description', seo.description);
    html = setProperty(html, 'og:type', 'website');
    html = setProperty(html, 'og:url', canonical);
    html = setProperty(html, 'og:site_name', 'سولمینت');
    html = setProperty(html, 'og:locale', 'fa_IR');
    html = setProperty(html, 'og:image', `${SITE}/images/blog-og.jpg`);
    html = setCanonical(html, canonical);

    if (indexable) {
      const cards = renderCards(articles);
      const shell = `<div id="solmint-taxonomy-ssr" dir="rtl" lang="fa"><nav aria-label="مسیر صفحه"><a href="/">خانه</a> / <a href="/blog">وبلاگ</a> / <span>${escapeHtml(categoryName)}</span></nav><main><header><p>دسته‌بندی مقالات سولمینت</p><h1>${escapeHtml(seo.h1)}</h1><p>${escapeHtml(seo.intro)}</p></header><section aria-labelledby="taxonomy-articles"><h2 id="taxonomy-articles">مقالات ${escapeHtml(categoryName)}</h2><p>در این بخش ${articles.length} مقاله منتشرشده قرار دارد.</p><div class="solmint-taxonomy-grid">${cards}</div></section></main></div>`;
      if (/<div id="root"><\/div>/i.test(html)) {
        html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${shell}</div>`);
      } else if (!html.includes('id="solmint-taxonomy-ssr"')) {
        html = html.replace(/<body([^>]*)>/i, `<body$1>${shell}`);
      }
      html = setBootstrap(html, {
        type: 'category',
        slug: rawSlug,
        name: categoryName,
        articles: articles.map(article => ({
          id: String(article.id || ''),
          title: String(article.title || ''),
          slug: String(article.slug || ''),
          category: categoryName,
          tags: Array.isArray(article.tags) ? article.tags.map(String) : [],
          summary: String(article.summary || ''),
          content: '',
          coverImage: String(article.cover_image || ''),
          author: { name: 'تیم تحریریه سولمینت', role: '', avatar: '' },
          publishedAt: String(article.published_at || ''),
          publishedAtJalali: article.published_at_jalali ? String(article.published_at_jalali) : undefined,
          publishedAtGregorian: article.published_at_gregorian ? String(article.published_at_gregorian) : undefined,
          readTimeMinutes: Number(article.read_time_minutes || 5),
          viewsCount: 0,
          comments: [],
          isDraft: false
        }))
      });
    }

    html = setJsonLd(html, indexable ? {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${canonical}#collection`,
      url: canonical,
      name: seo.title,
      headline: seo.h1,
      description: seo.description,
      inLanguage: 'fa-IR',
      isPartOf: { '@type': 'WebSite', '@id': `${SITE}#website`, url: SITE, name: 'سولمینت' },
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
          { '@type': 'ListItem', position: 3, name: seo.h1, item: canonical }
        ]
      }
    } : { '@context': 'https://schema.org', '@type': 'WebPage', url: canonical, name: seo.title, description: seo.description, inLanguage: 'fa-IR' });

    return new Response(html, { status: baseResponse.status, headers });
  } catch (error) {
    console.error('Taxonomy SSR failed:', error);
    return new Response(baseResponse.body, { status: baseResponse.status, statusText: baseResponse.statusText, headers: baseHeaders });
  }
};
