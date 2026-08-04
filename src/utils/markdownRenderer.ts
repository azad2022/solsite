export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(raw: string): string {
  const value = raw.trim();
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(value)) return escapeHtml(value);
  return '#';
}

function inlineMarkdown(value: string): string {
  let s = escapeHtml(value);
  s = s.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+[\"']([^\"']*)[\"'])?\)/g,
    (_m, alt, src, title) => `<img src="${safeUrl(src)}" alt="${alt}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy" decoding="async">`);
  s = s.replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+[\"']([^\"']*)[\"'])?\)/g,
    (_m, label, href, title) => `<a href="${safeUrl(href)}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer nofollow"' : ''}${title ? ` title="${escapeHtml(title)}"` : ''}>${label}</a>`);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return s;
}

export function renderMarkdownToHtml(markdown: string): string {
  const source = String(markdown ?? '').replace(/\r\n?/g, '\n').trim();
  if (!source) return '';
  const lines = source.split('\n');
  const out: string[] = [];
  let i = 0;
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(' ').trim();
    if (text) out.push(`<p>${inlineMarkdown(text)}</p>`);
    paragraph = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      flushParagraph();
      const language = line.replace(/^\s*```/, '').trim();
      i++;
      const code: string[] = [];
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      const lang = language.replace(/[^a-zA-Z0-9_-]/g, '');
      const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      out.push(`<pre><code${langClass}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flushParagraph();
      // The article title is the page-level H1. Shift Markdown headings down one level.
      const level = Math.min(heading[1].length + 1, 6);
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      i++;
      continue;
    }
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flushParagraph(); out.push('<hr>'); i++; continue;
    }
    if (/^\s*>/.test(line)) {
      flushParagraph();
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote><p>${inlineMarkdown(quote.join(' '))}</p></blockquote>`);
      continue;
    }
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const orderedList = Boolean(ordered);
      const items: string[] = [];
      while (i < lines.length) {
        const m = orderedList ? lines[i].match(/^\s*\d+[.)]\s+(.+)$/) : lines[i].match(/^\s*[-*+]\s+(.+)$/);
        if (!m) break;
        items.push(`<li>${inlineMarkdown(m[1])}</li>`); i++;
      }
      out.push(`<${orderedList ? 'ol' : 'ul'}>${items.join('')}</${orderedList ? 'ol' : 'ul'}>`);
      continue;
    }
    if (!line.trim()) { flushParagraph(); i++; continue; }
    paragraph.push(line.trim());
    i++;
  }
  flushParagraph();
  return out.join('\n');
}
