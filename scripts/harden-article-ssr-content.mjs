import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const articleFile = path.join(root, 'functions/article/[slug].ts');
const serverFile = path.join(root, 'server.ts');

function replaceRequired(file, source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Unable to locate ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

let changed = [];

// Preserve the rich HTML already stored by the CMS. Unknown/dangerous elements and event handlers are removed,
// while article semantics such as headings, paragraphs, lists, links, images, tables and code remain crawlable.
{
  let source = fs.readFileSync(articleFile, 'utf8');
  const before = source;
  const startMarker = 'function renderBody(value: string) {';
  const endMarker = '\n}\n\nfunction setMeta(';
  const replacement = `function renderBody(value: string) {
  const input = String(value || '').trim();
  if (!input) return '';

  if (!/<\\/?[a-z][\\s\\S]*>/i.test(input)) {
    const lines = input.replace(/\\r\\n?/g, '\\n').split('\\n');
    const out: string[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const heading = line.match(/^#{1,6}\\s+(.+?)\\s*#*$/);
      if (heading) {
        const level = Math.min(6, Math.max(2, line.match(/^#+/)?.[0].length || 2));
        out.push(\`<h\\${level}>\\${escapeHtml(heading[1])}</h\\${level}>\`);
      } else {
        out.push(\`<p>\\${escapeHtml(line)}</p>\`);
      }
    }
    return out.join('\\n');
  }

  const allowedTags = new Set([
    'p', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 'mark',
    'del', 's', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption',
    'pre', 'code', 'br', 'hr', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'sup', 'sub', 'span', 'div'
  ]);
  const voidTags = new Set(['img', 'br', 'hr']);
  const dangerousBlock = /<\\s*(script|style|iframe|object|embed|form|meta|link|base|svg|math)\\b[^>]*>[\\s\\S]*?<\\/\\s*\\1\\s*>/gi;
  const dangerousSelfClosing = /<\\s*(script|style|iframe|object|embed|form|meta|link|base|svg|math)\\b[^>]*\\/?\\s*>/gi;
  const comments = /<!--[\\s\\S]*?-->/g;

  const stripped = input.replace(comments, '').replace(dangerousBlock, '').replace(dangerousSelfClosing, '');
  return stripped.replace(/<\\/?([a-z][a-z0-9-]*)(\\s[^>]*)?>/gi, (full, rawTag, rawAttrs = '') => {
    const tag = String(rawTag).toLowerCase();
    if (!allowedTags.has(tag)) return '';
    if (full.startsWith('</')) return voidTags.has(tag) ? '' : \`</\\${tag}>\`;

    const attrs = [];
    const allowed = tag === 'a'
      ? new Set(['href', 'title', 'target', 'rel', 'aria-label'])
      : tag === 'img'
        ? new Set(['src', 'alt', 'title', 'loading', 'decoding', 'width', 'height'])
        : new Set(['title', 'aria-label', 'datetime', 'colspan', 'rowspan', 'scope']);
    const attrPattern = /([a-zA-Z_:][a-zA-Z0-9:._-]*)(?:\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+)))?/g;
    let match;
    while ((match = attrPattern.exec(String(rawAttrs || ''))) !== null) {
      const name = match[1].toLowerCase();
      const rawValue = match[2] ?? match[3] ?? match[4] ?? '';
      if (name.startsWith('on') || name === 'style' || name === 'srcset' || !allowed.has(name)) continue;
      if ((name === 'href' || name === 'src') && (!/^(https?:\\/\\/|\\/|#|mailto:)/i.test(rawValue) || /^(javascript|data|vbscript):/i.test(rawValue))) continue;
      attrs.push(\` \\${name}=\"\\${escapeHtml(rawValue)}\"\`);
    }
    if (tag === 'a' && attrs.some((item) => / target=\"_blank\"$/i.test(item)) && !attrs.some((item) => /^ rel=/i.test(item))) attrs.push(' rel=\"noopener noreferrer\"');
    return \`<\\${tag}\\${attrs.join('')}\\${voidTags.has(tag) ? ' />' : '>'}\`;
  });
}`;
  source = replaceRequired(articleFile, source, startMarker, endMarker, replacement, 'SSR renderBody function');
  if (source !== before) {
    fs.writeFileSync(articleFile, source, 'utf8');
    changed.push('functions/article/[slug].ts');
  }
}

// Express query parameters can be string | string[]. The disk cleanup helper accepts one id only.
{
  let source = fs.readFileSync(serverFile, 'utf8');
  const before = source;
  source = source.replace(
    '      deleteArticleFromDisk(articleId);',
    "      if (typeof articleId === 'string') deleteArticleFromDisk(articleId);"
  );
  if (source !== before) {
    fs.writeFileSync(serverFile, source, 'utf8');
    changed.push('server.ts');
  }
}

console.log(changed.length ? `Applied article SSR hardening: ${changed.join(', ')}` : 'Article SSR hardening already applied.');
