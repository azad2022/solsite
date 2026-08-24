import { CATEGORY_SLUGS } from '../src/config/articleTaxonomy';

type ArticleRecord = {
  title: string;
  slug: string;
  summary?: string | null;
  cover_image?: string | null;
  category?: string | null;
  tags?: string[] | null;
  published_at?: string | null;
  published_at_jalali?: string | null;
  read_time_minutes?: number | null;
  is_draft?: boolean | null;
};

type PageContext = { request: Request; next: () => Promise<Response>; env?: Record<string, string | undefined> };

const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_XaeRMCeIhR7-Zwq6YhdkVw_cOwO9OLt';
const SITE_ORIGIN = 'https://solmint.ir';

function esc(value: unknown) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;'); }
function stripHtml(value: string) { return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
function safeImage(value: unknown) { const raw = String(value || '').trim(); return /^(https?:|\/)/i.test(raw) && !/^(javascript|data|vbscript):/i.test(raw) ? raw : `${SITE_ORIGIN}/og-solmint.png`; }
function articleHref(slug: string) { return `/article/${encodeURIComponent(slug)}`; }
function categoryHref(category?: string | null) { const name = String(category || '').trim(); if (!name) return '/blog'; return `/blog/category/${encodeURIComponent(CATEGORY_SLUGS[name] || name)}`; }

function renderArticleLinks(articles: ArticleRecord[]) {
  if (!articles.length) return '<p class="blog-ssr-empty">مقالات منتشرشده‌ای برای نمایش پیدا نشد.</p>';
  const cards = articles.map(article => {
    const title = esc(article.title), href = esc(articleHref(article.slug)), summary = esc(stripHtml(String(article.summary || ''))), category = esc(article.category || 'مقاله'), date = esc(article.published_at_jalali || article.published_at || ''), image = esc(safeImage(article.cover_image)), readTime = esc(article.read_time_minutes || 5), catHref = esc(categoryHref(article.category));
    return `<article class="blog-ssr-card"><a href="${href}"><img src="${image}" alt="${title}" loading="lazy" decoding="async"><div><p class="blog-ssr-category"><span>${category}</span> · <a class="blog-ssr-category-link" href="${catHref}">مشاهده دسته</a></p><h3>${title}</h3>${summary ? `<p>${summary}</p>` : ''}<small>${date}${date ? ' · ' : ''}${readTime} دقیقه مطالعه</small></div></a></article>`;
  }).join('');
  return `<main id="blog-ssr-index" aria-labelledby="blog-ssr-index-title"><h1 id="blog-ssr-index-title">وبلاگ و آکادمی آموزشی سولمینت</h1><div class="blog-ssr-grid">${cards}</div></main>`;
}

function setMeta(html: string, name: string, value: string, property = false): string {
  const attr = property ? 'property' : 'name';
  const tag = `<meta ${attr}="${name}" content="${esc(value)}">`;
  const rx = new RegExp(`<meta\\s+${attr}=["']${name}["'][^>]*>`, 'i');
  return rx.test(html) ? html.replace(rx, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function setCanonical(html: string, url: string): string {
  const tag = `<link rel="canonical" href="${esc(url)}">`;
  return /<link\s+rel=["']canonical["'][^>]*>/i.test(html) ? html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function inject(html: string, articles: ArticleRecord[]) {
  const title = 'وبلاگ و آکادمی آموزشی سولمینت | آموزش وب۳، سولانا و کریپتو';
  const description = 'مقالات تخصصی و آموزش‌های جامع سولانا، ساخت توکن، مدیریت کیف پول غیرامانی، امنیت کریپتو و اخبار تحلیلی شبکه سولانا در آکادمی سولمینت.';
  const canonical = `${SITE_ORIGIN}/blog`;
  const style = `<style id="blog-ssr-style">#blog-ssr-index{max-width:1200px;margin:0 auto;padding:24px 16px 56px;direction:rtl}#blog-ssr-index-title{font-size:24px;font-weight:900;color:#fff;margin:0 0 20px}.blog-ssr-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.blog-ssr-card{border:1px solid rgba(148,163,184,.16);border-radius:20px;overflow:hidden;background:rgba(15,23,42,.72)}.blog-ssr-card>a{display:block;color:inherit;text-decoration:none}.blog-ssr-card img{width:100%;height:170px;object-fit:cover}.blog-ssr-card div{padding:16px}.blog-ssr-category{font-size:11px;color:#94a3b8;margin:0 0 8px}.blog-ssr-category-link{color:#38bdf8;text-decoration:underline}.blog-ssr-card h3{font-size:16px;line-height:1.7;margin:0;color:#fff}.blog-ssr-card p:not(.blog-ssr-category){font-size:12px;line-height:1.9;color:#94a3b8;margin:8px 0 0}.blog-ssr-card small{display:block;font-size:11px;color:#64748b;margin-top:10px}.blog-ssr-empty{color:#94a3b8}@media(max-width:800px){.blog-ssr-grid{grid-template-columns:1fr}}@media(min-width:801px) and (max-width:1050px){.blog-ssr-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>`;
  
  let result = html;
  result = result.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  result = setCanonical(result, canonical);
  result = setMeta(result, 'description', description);
  result = setMeta(result, 'robots', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
  result = setMeta(result, 'og:type', 'website', true);
  result = setMeta(result, 'og:url', canonical, true);
  result = setMeta(result, 'og:title', title, true);
  result = setMeta(result, 'og:description', description, true);
  result = result.replace('</head>', `  ${style}\n</head>`);
  result = result.replace(/<div id="root"><\/div>/i, `<div id="root">${renderArticleLinks(articles)}</div>`);
  return result;
}

export async function onRequest(context: PageContext): Promise<Response> {
  const env = context.env || {};
  const base = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = String(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();
  let articles: ArticleRecord[] = [];
  if (key) {
    try {
      const endpoint = `${base}/rest/v1/articles?select=title,slug,summary,cover_image,category,tags,published_at,published_at_jalali,read_time_minutes,is_draft&is_draft=eq.false&order=published_at.desc&limit=50`;
      const response = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' } });
      if (response.ok) { const rows = await response.json(); articles = Array.isArray(rows) ? rows.filter((row: ArticleRecord) => Boolean(row.slug) && !row.is_draft) : []; }
    } catch {}
  }
  const upstream = await context.next();
  const html = await upstream.text();
  if (!html) return upstream;
  const headers = new Headers(upstream.headers);
  headers.set('Content-Type', 'text/html; charset=UTF-8');
  headers.set('X-Solmint-SSR', 'blog-discovery-v4');
  headers.set('X-Robots-Tag', 'index, follow');
  return new Response(inject(html, articles), { status: upstream.status, headers });
}
