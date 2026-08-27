type PagesContext = {
  request: Request;
  next: () => Promise<Response>;
};

type MiddlewareHandler = (context: PagesContext) => Promise<Response>;

const BLOCKED_SENSITIVE_PATHS = new Set([
  '/.env',
  '/.env.local',
  '/.env.production',
  '/.git/config',
  '/backup.tar',
  '/backup.tar.gz',
  '/backup.zip',
  '/database.sql',
  '/db.sql',
  '/dump.sql',
]);

function isSensitivePath(request: Request): boolean {
  const pathname = new URL(request.url).pathname.toLowerCase();
  if (BLOCKED_SENSITIVE_PATHS.has(pathname)) return true;

  // Never allow common archive/database backup extensions to fall through
  // to the SPA HTML response, even when no static file exists.
  if (/\.(?:tar|tar\.gz|tgz|zip|sql|sqlite|sqlite3)$/i.test(pathname)) return true;

  return false;
}

function acceptsMarkdown(request: Request): boolean {
  const accept = request.headers.get('Accept') || '';
  return accept
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .some((part) => part === 'text/markdown' || part.startsWith('text/markdown;'));
}

function stripComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function inlineMarkdown(html: string): string {
  let value = html;
  value = value.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  value = value.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`');
  value = value.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**');
  value = value.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*');
  value = value.replace(/<br\s*\/?>/gi, '\n');
  value = value.replace(/<[^>]+>/g, '');
  return decodeEntities(value).replace(/[ \t]+\n/g, '\n').trim();
}

function htmlToMarkdown(html: string): string {
  let source = stripComments(html);

  source = source.replace(/<script\b(?![^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi, '');
  source = source.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  source = source.replace(/<(header|footer|nav|aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

  source = source.replace(/<img\s+[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi, '![$1]($2)');
  source = source.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, '![$2]($1)');

  source = source.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  source = source.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  source = source.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  source = source.replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  source = source.replace(/<h5\b[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
  source = source.replace(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');

  source = source.replace(/<pre\b[^>]*><code\b[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
  source = source.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n');

  source = source.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  source = source.replace(/<\/ul>/gi, '\n');
  source = source.replace(/<\/ol>/gi, '\n');

  source = source.replace(/<hr\s*\/?>/gi, '\n---\n');
  source = source.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
  source = source.replace(/<(div|section|article|main)\b[^>]*>/gi, '\n');
  source = source.replace(/<\/(div|section|article|main)>/gi, '\n');
  source = source.replace(/<br\s*\/?>/gi, '\n');

  source = inlineMarkdown(source);

  source = source
    .replace(/\r/g, '')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return source ? `${source}\n` : '';
}

function extractMeta(html: string) {
  const getMeta = (name: string) => {
    const rx = new RegExp(`<meta\\s+name=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i');
    return html.match(rx)?.[1] || '';
  };
  const getProperty = (property: string) => {
    const rx = new RegExp(`<meta\\s+property=["']${property}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i');
    return html.match(rx)?.[1] || '';
  };
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || getMeta('title') || getProperty('og:title');
  const description = getMeta('description') || getProperty('og:description');
  const image = getProperty('og:image');
  return { title: decodeEntities(title), description: decodeEntities(description), image: decodeEntities(image) };
}

function extractJsonLd(html: string): string[] {
  return Array.from(html.matchAll(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function toFrontmatter(meta: ReturnType<typeof extractMeta>): string {
  const lines = ['---'];
  if (meta.title) lines.push(`title: ${JSON.stringify(meta.title)}`);
  if (meta.description) lines.push(`description: ${JSON.stringify(meta.description)}`);
  if (meta.image) lines.push(`image: ${JSON.stringify(meta.image)}`);
  if (lines.length === 1) return '';
  lines.push('---', '');
  return lines.join('\n');
}

function approximateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

const markdownMiddleware: MiddlewareHandler = async (context) => {
  if (isSensitivePath(context.request)) {
    return new Response('Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  if (!acceptsMarkdown(context.request)) return context.next();

  const origin = await context.next();
  const contentType = origin.headers.get('Content-Type') || '';

  if (origin.status < 200 || origin.status >= 300 || !contentType.toLowerCase().includes('text/html')) {
    return origin;
  }

  const html = await origin.text();
  const meta = extractMeta(html);
  const body = htmlToMarkdown(html);
  const jsonLd = extractJsonLd(html);
  const markdown = `${toFrontmatter(meta)}${body}${jsonLd.length ? '\n\n```json\n' + jsonLd.join('\n') + '\n```\n' : ''}`;

  const headers = new Headers(origin.headers);
  headers.set('Content-Type', 'text/markdown; charset=utf-8');
  headers.set('Vary', headers.get('Vary') ? `${headers.get('Vary')}, Accept` : 'Accept');
  headers.set('X-Markdown-Tokens', String(approximateTokens(markdown)));
  headers.set('X-Original-Tokens', String(approximateTokens(html)));
  headers.delete('Content-Length');
  headers.delete('ETag');
  headers.delete('Last-Modified');
  headers.delete('Content-Encoding');
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');

  return new Response(markdown, { status: origin.status, headers });
};

export const onRequest = markdownMiddleware;
