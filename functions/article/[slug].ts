type ArticleRecord = {
  id: string;
  title: string;
  slug: string;
  category?: string;
  tags?: string[];
  summary?: string;
  content?: string;
  cover_image?: string;
  video_url?: string;
  author?: { name?: string; role?: string; avatar?: string };
  published_at?: string;
  published_at_jalali?: string;
  published_at_gregorian?: string;
  read_time_minutes?: number;
  is_draft?: boolean;
};

type PageContext = { request: Request; next: () => Promise<Response>; env?: Record<string, string | undefined>; params: { slug: string } };

const SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XaeRMCeIhR7-Zwq6YhdkVw_cOwO9OLt';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeUrl(value: unknown): string {
  const url = String(value ?? '').trim();
  return /^(https?:|\/|#)/i.test(url) && !/^(javascript|data|vbscript):/i.test(url) ? url : '#';
}

function inlineMarkdown(value: string): string {
  let s = escapeHtml(value);
  s = s.replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, (_m, alt, src) => `<img src="${escapeHtml(safeUrl(src))}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`);
  s = s.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_m, label, href) => `<a href="${escapeHtml(safeUrl(href))}"${/^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer nofollow"' : ''}>${label}</a>`);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/_([^_]+)_/g, '<em>$1</em>');
  return s;
}

function renderArticleBody(source: string): string {
  const normalized = String(source || '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) return '';
  // Server-side rendering intentionally uses a strict Markdown subset. The source is escaped first,
  // so CMS/AI HTML cannot become executable markup before the browser hydrates the application.
  const lines = normalized.split('\n');
  const output: string[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(' ').trim();
    if (text) output.push(`<p>${inlineMarkdown(text)}</p>`);
    paragraph = [];
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (heading) {
      flush();
      const rawLevel = line.match(/^(#{1,6})/)?.[1].length || 2;
      const level = Math.min(Math.max(rawLevel + 1, 2), 6);
      output.push(`<h${level}>${inlineMarkdown(heading[1])}</h${level}>`);
      i++; continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      flush(); const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i].trim())) { items.push(`<li>${inlineMarkdown(lines[i].trim().replace(/^[-*+]\s+/, ''))}</li>`); i++; }
      output.push(`<ul>${items.join('')}</ul>`); continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flush(); const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i].trim())) { items.push(`<li>${inlineMarkdown(lines[i].trim().replace(/^\d+[.)]\s+/, ''))}</li>`); i++; }
      output.push(`<ol>${items.join('')}</ol>`); continue;
    }
    if (!line) { flush(); i++; continue; }
    paragraph.push(line); i++;
  }
  flush();
  return output.join('\n');
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function descriptionFor(article: ArticleRecord): string {
  const source = String(article.summary || stripHtml(article.content || '')).trim();
  return source.length > 160 ? `${source.slice(0, 157).replace(/\s+\S*$/, '')}...` : source;
}

function articleJsonLd(article: ArticleRecord, canonical: string): string {
  const published = article.published_at || new Date().toISOString();
  const authorName = article.author?.name || 'تیم تحریریه سولمینت';
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: descriptionFor(article),
    url: canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    datePublished: published,
    dateModified: published,
    author: { '@type': 'Person', name: authorName },
    publisher: { '@type': 'Organization', name: 'Solmint', url: 'https://solmint.ir/' },
    image: article.cover_image ? [article.cover_image] : ['https://solmint.ir/og-solmint.png'],
    articleSection: article.category || 'اخبار و تحلیل',
    keywords: Array.isArray(article.tags) ? article.tags : []
  }).replace(/</g, '\\u003c');
}

function replaceMeta(html: string, nameOrProperty: string, value: string, isProperty = false): string {
  const attr = isProperty ? 'property' : 'name';
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`<meta\\s+${attr}=["']${nameOrProperty}["'][^>]*>`, 'i');
  const tag = `<meta ${attr}="${nameOrProperty}" content="${escaped}">`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function replaceTitle(html: string, title: string): string {
  const tag = `<title>${escapeHtml(title)}</title>`;
  return /<title>[^<]*<\/title>/i.test(html) ? html.replace(/<title>[^<]*<\/title>/i, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function replaceCanonical(html: string, canonical: string): string {
  const tag = `<link rel="canonical" href="${escapeHtml(canonical)}">`;
  return /<link\s+rel=["']canonical["'][^>]*>/i.test(html) ? html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function replaceJsonLd(html: string, json: string): string {
  const script = `<script id="article-jsonld" type="application/ld+json">${json}</script>`;
  const pattern = /<script[^>]*id=["']article-jsonld["'][^>]*>[\s\S]*?<\/script>/i;
  return pattern.test(html) ? html.replace(pattern, script) : html.replace('</head>', `    ${script}\n  </head>`);
}

function injectArticleShell(html: string, article: ArticleRecord): string {
  const canonical = `https://solmint.ir/article/${encodeURIComponent(article.slug)}`;
  const title = `${article.title} | سولمینت`;
  const description = descriptionFor(article);
  const body = renderArticleBody(article.content || '');
  const image = safeUrl(article.cover_image || 'https://solmint.ir/og-solmint.png');
  const author = article.author?.name || 'تیم تحریریه سولمینت';
  const date = article.published_at || new Date().toISOString();
  const tags = Array.isArray(article.tags) ? article.tags : [];
  const articleShell = `<main id="article-ssr" dir="rtl" lang="fa"><article><header><nav aria-label="مسیر صفحه"><a href="/">سولمینت</a> / <a href="/blog">وبلاگ</a> / <span>${escapeHtml(article.category || 'مقاله')}</span></nav><p><time datetime="${escapeHtml(date)}">${escapeHtml(article.published_at_jalali || article.published_at_gregorian || date)}</time> · ${escapeHtml(article.read_time_minutes || 5)} دقیقه مطالعه</p><h1>${escapeHtml(article.title)}</h1><p>${escapeHtml(description)}</p><p>نویسنده: ${escapeHtml(author)}</p></header>${image !== '#' ? `<figure><img src="${escapeHtml(image)}" alt="${escapeHtml(article.title)}" fetchpriority="high"><figcaption>${escapeHtml(article.title)}</figcaption></figure>` : ''}<section aria-label="متن مقاله">${body}</section>${tags.length ? `<footer><h2>برچسب‌ها</h2><ul>${tags.map(tag => `<li><a href="/blog/tag/${encodeURIComponent(tag.trim().toLocaleLowerCase('fa-IR').replace(/\s+/g, '-'))}">${escapeHtml(tag)}</a></li>`).join('')}</ul></footer>` : ''}</article></main>`;
  let result = html;
  result = replaceTitle(result, title);
  result = replaceCanonical(result, canonical);
  result = replaceMeta(result, 'description', description);
  result = replaceMeta(result, 'author', author);
  result = replaceMeta(result, 'robots', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
  result = replaceMeta(result, 'og:type', 'article', true);
  result = replaceMeta(result, 'og:url', canonical, true);
  result = replaceMeta(result, 'og:title', title, true);
  result = replaceMeta(result, 'og:description', description, true);
  result = replaceMeta(result, 'og:image', image, true);
  result = replaceMeta(result, 'twitter:title', title);
  result = replaceMeta(result, 'twitter:description', description);
  result = replaceMeta(result, 'twitter:image', image);
  result = replaceJsonLd(result, articleJsonLd(article, canonical));
  result = result.replace(/<div id="root"><\/div>/i, `<div id="root">${articleShell}</div>`);
  return result;
}

export async function onRequest(context: PageContext): Promise<Response> {
  const slug = decodeURIComponent(String(context.params.slug || '')).trim();
  if (!slug || slug.length > 200) return context.next();

  const env = context.env || {};
  const baseUrl = env.SUPABASE_URL || SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
  const endpoint = `${baseUrl.replace(/\/$/, '')}/rest/v1/articles?select=id,title,slug,category,tags,summary,content,cover_image,video_url,author,published_at,published_at_jalali,published_at_gregorian,read_time_minutes,is_draft&slug=eq.${encodeURIComponent(slug)}&is_draft=eq.false&limit=1`;

  try {
    const upstream = await fetch(endpoint, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Accept: 'application/json' } });
    if (!upstream.ok) return context.next();
    const rows = await upstream.json() as ArticleRecord[];
    const article = rows[0];
    if (!article) {
      const fallback = await context.next();
      const headers = new Headers(fallback.headers);
      headers.set('X-Robots-Tag', 'noindex, follow');
      return new Response(fallback.body, { status: 404, headers });
    }

    const shellResponse = await context.next();
    let html = await shellResponse.text();
    if (!/<div id="root"><\/div>/i.test(html)) {
      const originResponse = await fetch(new URL('/', context.request.url), { headers: { Accept: 'text/html' } });
      if (originResponse.ok) html = await originResponse.text();
    }
    html = injectArticleShell(html, article);
    const headers = new Headers(shellResponse.headers);
    headers.set('Content-Type', 'text/html; charset=UTF-8');
    headers.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
    headers.set('X-Robots-Tag', 'index, follow');
    return new Response(html, { status: 200, headers });
  } catch {
    return context.next();
  }
}
