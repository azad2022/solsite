import { CATEGORY_SLUGS, getCanonicalTagSlug } from '../../src/config/articleTaxonomy';
import { detectArticleLocale } from '../seo-helpers';

type ArticleRecord = {
  id: string;
  title: string;
  slug: string;
  category?: string | null;
  category_id?: string | null;
  tags?: string[] | null;
  summary?: string | null;
  content?: string | null;
  cover_image?: string | null;
  author?: { name?: string; role?: string; avatar?: string } | null;
  published_at?: string | null;
  published_at_jalali?: string | null;
  published_at_gregorian?: string | null;
  updated_at?: string | null;
  read_time_minutes?: number | null;
  is_draft?: boolean | null;
};

type RelatedArticle = Pick<ArticleRecord, 'id' | 'title' | 'slug' | 'summary' | 'cover_image'>;
type PageContext = {
  request: Request;
  next: () => Promise<Response>;
  env?: Record<string, string | undefined>;
  params: { slug: string };
};

const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const SITE_ORIGIN = 'https://solmint.ir';

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\"/g, '&quot;')
  .replace(/'/g, '&#39;');

const safeUrl = (value: unknown) => {
  const url = String(value ?? '').trim();
  return /^(https?:|\/|#)/i.test(url) && !/^(javascript|data|vbscript):/i.test(url) ? url : '#';
};

const articleUrl = (slug: string) => `/article/${encodeURIComponent(slug)}`;
const categorySlug = (name?: string | null) => CATEGORY_SLUGS[String(name || '').trim()] || getCanonicalTagSlug(String(name || ''));
const categoryUrl = (name?: string | null) => name ? `/blog/category/${encodeURIComponent(categorySlug(name))}` : null;
const tagUrl = (tag: string) => `/blog/tag/${encodeURIComponent(getCanonicalTagSlug(String(tag || '').trim()))}`;

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function descriptionFor(article: ArticleRecord) {
  const source = String(article.summary || stripHtml(article.content || '')).trim();
  if (!source) return `راهنمای تخصصی ${article.title} در سولمینت.`;
  return source.length > 160 ? `${source.slice(0, 157).replace(/\s+\S*$/, '')}...` : source;
}

function renderBody(value: string) {
  const input = String(value || '').trim();
  if (!input) return '';

  if (!/<\/?[a-z][\s\S]*>/i.test(input)) {
    const lines = input.replace(/\r\n?/g, '\n').split('\n');
    const out: string[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
      if (heading) {
        const level = Math.min(6, Math.max(2, line.match(/^#+/)?.[0].length || 2));
        out.push('<h' + level + '>' + escapeHtml(heading[1]) + '</h' + level + '>');
      } else {
        out.push('<p>' + escapeHtml(line) + '</p>');
      }
    }
    return out.join('\n');
  }

  const allowedTags = new Set([
    'p', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 'mark',
    'del', 's', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption',
    'pre', 'code', 'br', 'hr', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'sup', 'sub', 'span', 'div'
  ]);
  const voidTags = new Set(['img', 'br', 'hr']);
  const dangerousBlock = /<\s*(script|style|iframe|object|embed|form|meta|link|base|svg|math)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi;
  const dangerousSelfClosing = /<\s*(script|style|iframe|object|embed|form|meta|link|base|svg|math)\b[^>]*\/?\s*>/gi;
  const comments = /<!--[\s\S]*?-->/g;

  const stripped = input.replace(comments, '').replace(dangerousBlock, '').replace(dangerousSelfClosing, '');
  return stripped.replace(/<\/?([a-z][a-z0-9-]*)(\s[^>]*)?>/gi, (full, rawTag, rawAttrs = '') => {
    const tag = String(rawTag).toLowerCase();
    if (!allowedTags.has(tag)) return "";
    if (full.startsWith('</')) return voidTags.has(tag) ? '' : '</' + tag + '>';

    const attrs: string[] = [];
    const allowed = tag === 'a'
      ? new Set(['href', 'title', 'target', 'rel', 'aria-label', 'class', 'id'])
      : tag === 'img'
        ? new Set(['src', 'alt', 'title', 'loading', 'decoding', 'width', 'height', 'class', 'id'])
        : new Set(['title', 'aria-label', 'datetime', 'colspan', 'rowspan', 'scope', 'class', 'id']);
    const attrPattern = /([a-zA-Z_:][a-zA-Z0-9:._-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let match;
    while ((match = attrPattern.exec(String(rawAttrs || ''))) !== null) {
      const name = match[1].toLowerCase();
      const rawValue = match[2] ?? match[3] ?? match[4] ?? '';
      if (name.startsWith('on') || name === 'style' || name === 'srcset' || !allowed.has(name)) continue;
      if (name === 'href' || name === 'src') {
        if (!/^(https?:\/\/|\/|#|mailto:)/i.test(rawValue) || /^(javascript|data|vbscript):/i.test(rawValue)) continue;
      }
      attrs.push(' ' + name + '="' + escapeHtml(rawValue) + '"');
    }
    if (tag === 'a' && attrs.some((item) => / target="_blank"$/i.test(item)) && !attrs.some((item) => /^ rel=/i.test(item))) attrs.push(' rel="noopener noreferrer"');
    return '<' + tag + attrs.join('') + (voidTags.has(tag) ? ' />' : '>');
  });
}

function setMeta(html: string, name: string, value: string, property = false) {
  const attr = property ? 'property' : 'name';
  const tag = `<meta ${attr}="${escapeHtml(name)}" content="${escapeHtml(value)}">`;
  const rx = new RegExp(`<meta\\s+${attr}=["']${name}["'][^>]*>`, 'i');
  return rx.test(html) ? html.replace(rx, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function setTitle(html: string, value: string) {
  const tag = `<title>${escapeHtml(value)}</title>`;
  return /<title>[^<]*<\/title>/i.test(html) ? html.replace(/<title>[^<]*<\/title>/i, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function setCanonical(html: string, url: string) {
  const tag = `<link rel="canonical" href="${escapeHtml(url)}">`;
  return /<link\s+rel=["']canonical["'][^>]*>/i.test(html)
    ? html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, tag)
    : html.replace('</head>', `    ${tag}\n  </head>`);
}

function setJsonLd(html: string, value: unknown) {
  const tag = `<script id="article-jsonld" type="application/ld+json">${JSON.stringify(value).replace(/</g, '\\u003c')}</script>`;
  const rx = /<script[^>]*id=["']article-jsonld["'][^>]*>[\s\S]*?<\/script>/i;
  return rx.test(html) ? html.replace(rx, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function setArticleBootstrap(html: string, article: ArticleRecord) {
  const payload = JSON.stringify(article).replace(/</g, '\\u003c');
  const tag = `<script id="solmint-article-bootstrap" type="application/json">${payload}</script>`;
  const rx = /<script[^>]*id=["']solmint-article-bootstrap["'][^>]*>[\s\S]*?<\/script>/i;
  return rx.test(html) ? html.replace(rx, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function setDocumentLanguage(html: string, lang: string, dir: string) {
  return html.replace(/<html\b[^>]*>/i, `<html lang="${escapeHtml(lang)}" dir="${escapeHtml(dir)}">`);
}

async function fetchRelated(base: string, key: string, article: ArticleRecord): Promise<RelatedArticle[]> {
  if (!article.category_id) return [];
  const url = `${base}/rest/v1/articles?select=id,title,slug,summary,cover_image,published_at&category_id=eq.${encodeURIComponent(article.category_id)}&id=neq.${encodeURIComponent(article.id)}&is_draft=eq.false&order=published_at.desc,id.desc&limit=5`;
  try {
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return [];
    const rows = await response.json();
    return Array.isArray(rows) ? rows as RelatedArticle[] : [];
  } catch {
    return [];
  }
}

function relatedHtml(items: RelatedArticle[]) {
  if (!items.length) return '';
  return `<aside id="related-articles" aria-label="مقالات مرتبط"><h2>مقالات مرتبط</h2><ul>${items.map(item => `<li><a href="${escapeHtml(articleUrl(item.slug))}" class="related-article-link">${item.cover_image ? `<img src="${escapeHtml(safeUrl(item.cover_image))}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async">` : ''}<span><strong class="related-article-title">${escapeHtml(item.title)}</strong>${item.summary ? `<small>${escapeHtml(stripHtml(item.summary))}</small>` : ''}</span></a></li>`).join('')}</ul></aside>`;
}

function inject(html: string, article: ArticleRecord, related: RelatedArticle[]) {
  const locale = detectArticleLocale(article);
  const canonical = `${SITE_ORIGIN}${articleUrl(article.slug)}`;
  const title = `${article.title} | سولمینت`;
  const description = descriptionFor(article);
  const published = article.published_at || new Date().toISOString();
  const modified = article.updated_at || published;
  const categoryLink = categoryUrl(article.category);
  const category = article.category && categoryLink
    ? `<a href="${escapeHtml(categoryLink)}">${escapeHtml(article.category)}</a>`
    : `<span>${escapeHtml(article.category || 'مقاله')}</span>`;
  const image = safeUrl(article.cover_image || `${SITE_ORIGIN}/og-solmint.png`);

  const breadcrumb = [
    { '@type': 'ListItem', position: 1, name: 'خانه', item: SITE_ORIGIN },
    { '@type': 'ListItem', position: 2, name: 'وبلاگ', item: `${SITE_ORIGIN}/blog` }
  ];
  if (article.category && categoryLink) breadcrumb.push({ '@type': 'ListItem', position: 3, name: article.category, item: `${SITE_ORIGIN}${categoryLink}` });
  breadcrumb.push({ '@type': 'ListItem', position: breadcrumb.length + 1, name: article.title, item: canonical });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description,
    url: canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    datePublished: published,
    dateModified: modified,
    inLanguage: locale.schemaLanguage,
    author: { '@type': 'Person', name: article.author?.name || 'تیم تحریریه سولمینت' },
    publisher: {
      '@type': 'Organization',
      name: 'Solmint',
      url: `${SITE_ORIGIN}/`,
      logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/og-solmint.png` }
    },
    image: [image],
    articleSection: article.category || 'اخبار و تحلیل',
    keywords: article.tags || [],
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: breadcrumb }
  };

  const tags = Array.isArray(article.tags) && article.tags.length
    ? `<footer><h2>${locale.lang === 'en' ? 'Tags' : 'برچسب‌ها'}</h2><ul>${article.tags.map(tag => `<li><a href="${escapeHtml(tagUrl(String(tag)))}">${escapeHtml(tag)}</a></li>`).join('')}</ul></footer>`
    : '';

  const shell = `<main id="article-ssr" dir="${escapeHtml(locale.dir)}" lang="${escapeHtml(locale.lang)}"><article><header><nav aria-label="مسیر صفحه"><a href="/">سولمینت</a> / <a href="/blog">وبلاگ</a> / ${category} / <span aria-current="page">${escapeHtml(article.title)}</span></nav><h1>${escapeHtml(article.title)}</h1><p>${escapeHtml(description)}</p><p><time datetime="${escapeHtml(published)}">${escapeHtml(article.published_at_jalali || article.published_at_gregorian || published)}</time> · ${escapeHtml(article.read_time_minutes || 5)} ${locale.lang === 'en' ? 'minutes' : 'دقیقه مطالعه'}</p></header>${image !== '#' ? `<figure><img src="${escapeHtml(image)}" alt="${escapeHtml(article.title)}" fetchpriority="high"></figure>` : ''}<section aria-label="${locale.lang === 'en' ? 'Article body' : 'متن مقاله'}">${renderBody(article.content || '')}</section>${tags}${relatedHtml(related)}</article></main>`;

  let result = html;
  result = setDocumentLanguage(result, locale.lang, locale.dir);
  result = setArticleBootstrap(result, article);
  result = setTitle(result, title);
  result = setCanonical(result, canonical);
  result = setMeta(result, 'description', description);
  result = setMeta(result, 'robots', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
  result = setMeta(result, 'author', article.author?.name || 'تیم تحریریه سولمینت');
  result = setMeta(result, 'og:type', 'article', true);
  result = setMeta(result, 'og:url', canonical, true);
  result = setMeta(result, 'og:title', title, true);
  result = setMeta(result, 'og:description', description, true);
  result = setMeta(result, 'og:image', image, true);
  result = setMeta(result, 'og:locale', locale.ogLocale, true);
  result = setMeta(result, 'twitter:title', title);
  result = setMeta(result, 'twitter:description', description);
  result = setMeta(result, 'twitter:url', canonical);
  result = setMeta(result, 'twitter:image', image);
  result = setJsonLd(result, jsonLd);
  return result.replace(/<div id="root"><\/div>/i, `<div id="root">${shell}</div>`);
}

function serviceUnavailable() {
  return new Response('Article rendering temporarily unavailable', {
    status: 503,
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Retry-After': '60',
      'X-Robots-Tag': 'noindex, follow',
      'X-Solmint-SSR': 'article-seo-v4'
    }
  });
}

function notFound() {
  return new Response('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>مقاله پیدا نشد | سولمینت</title><meta name="robots" content="noindex, follow"></head><body><main><h1>مقاله مورد نظر پیدا نشد</h1></main></body></html>', {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      'X-Robots-Tag': 'noindex, follow',
      'X-Solmint-SSR': 'article-seo-v4'
    }
  });
}

export async function onRequest(context: PageContext): Promise<Response> {
  const slug = decodeURIComponent(String(context.params.slug || '')).trim();
  if (!slug || slug.length > 200) return context.next();
  if (slug === 'solana-price-live-today') return Response.redirect(`${SITE_ORIGIN}/solana-price`, 301);

  const env = context.env || {};
  const base = (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = String(
    env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_XaeRMCeIhR7-Zwq6YhdkVw_cOwO9OLt'
  ).trim();
  if (!key) return serviceUnavailable();

  const endpoint = `${base}/rest/v1/articles?select=id,title,slug,category,category_id,tags,summary,content,cover_image,author,published_at,published_at_jalali,published_at_gregorian,updated_at,read_time_minutes,is_draft&slug=eq.${encodeURIComponent(slug)}&is_draft=eq.false&limit=1`;

  try {
    const upstream = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (!upstream.ok) return serviceUnavailable();

    const rows = await upstream.json() as ArticleRecord[];
    const article = rows[0];
    if (!article) return notFound();

    const shellResponse = await context.next();
    if (!shellResponse.ok || !(shellResponse.headers.get('Content-Type') || '').toLowerCase().includes('text/html')) return serviceUnavailable();

    let html = await shellResponse.text();
    if (!/<div id="root"><\/div>/i.test(html)) {
      const originResponse = await fetch(new URL('/', context.request.url), { headers: { Accept: 'text/html' } });
      if (!originResponse.ok || !(originResponse.headers.get('Content-Type') || '').toLowerCase().includes('text/html')) return serviceUnavailable();
      html = await originResponse.text();
    }

    const related = await fetchRelated(base, key, article);
    const headers = new Headers(shellResponse.headers);
    headers.set('Content-Type', 'text/html; charset=UTF-8');
    headers.set('X-Robots-Tag', 'index, follow');
    headers.set('X-Solmint-SSR', 'article-seo-v4');
    headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');
    if (article.updated_at) headers.set('Last-Modified', new Date(article.updated_at).toUTCString());

    return new Response(inject(html, article, related), { status: 200, headers });
  } catch (error) {
    console.error('[article-ssr] failed to render article:', error);
    return serviceUnavailable();
  }
}
