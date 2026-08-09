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
  if (!value) return '#';
  if (/^(?:https?:|mailto:|tel:|\/|#)/i.test(value) && !/^(?:javascript|data|vbscript):/i.test(value)) {
    return escapeHtml(value);
  }
  return '#';
}

function isTrustedLiveChartSrc(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' &&
      url.hostname === 'nvopkbiedorfshwbmyhn.supabase.co' &&
      url.pathname === '/functions/v1/solana-live-chart-v3';
  } catch {
    return false;
  }
}

function sanitizeArticleHtml(source: string): string {
  if (typeof DOMParser === 'undefined') return escapeHtml(source);
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const allowed = new Set([
    'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I',
    'DEL', 'S', 'BLOCKQUOTE', 'BR', 'HR', 'A', 'IMG', 'IFRAME', 'PRE', 'CODE',
    'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD'
  ]);

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const element = node as HTMLElement;
    const tag = element.tagName;
    if (!allowed.has(tag)) return Array.from(element.childNodes).map(walk).join('');
    if (tag === 'BR') return '<br>';
    if (tag === 'HR') return '<hr>';

    if (tag === 'IFRAME') {
      const src = element.getAttribute('src') || '';
      if (!isTrustedLiveChartSrc(src)) return '';
      return `<div class="article-live-chart" style="width:100%;margin:24px 0;border-radius:18px;overflow:hidden"><iframe src="${escapeHtml(src)}" title="نمودار زنده قیمت سولانا" loading="lazy" style="display:block;width:100%;height:470px;border:0" referrerpolicy="no-referrer"></iframe></div>`;
    }

    const children = Array.from(element.childNodes).map(walk).join('');

    if (tag === 'A') {
      const href = element.getAttribute('href') || '#';
      const external = /^https?:\/\//i.test(href);
      return `<a href="${safeUrl(href)}"${external ? ' target="_blank" rel="noopener noreferrer nofollow"' : ''}>${children}</a>`;
    }

    if (tag === 'IMG') {
      return `<img src="${safeUrl(element.getAttribute('src') || '#')}" alt="${escapeHtml(element.getAttribute('alt') || '')}" loading="lazy" decoding="async">`;
    }

    if (tag === 'TH' || tag === 'TD') {
      const colspan = Number(element.getAttribute('colspan'));
      const rowspan = Number(element.getAttribute('rowspan'));
      const col = Number.isInteger(colspan) && colspan >= 1 && colspan <= 20 ? ` colspan="${colspan}"` : '';
      const row = Number.isInteger(rowspan) && rowspan >= 1 && rowspan <= 20 ? ` rowspan="${rowspan}"` : '';
      return `<${tag.toLowerCase()}${col}${row}>${children}</${tag.toLowerCase()}>`;
    }

    return `<${tag.toLowerCase()}>${children}</${tag.toLowerCase()}>`;
  };

  return Array.from(doc.body.childNodes).map(walk).join('');
}

function inlineMarkdown(value: string): string {
  let text = escapeHtml(value);
  text = text.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+["']([^"']*)["'])?\)/g,
    (_match, alt, src, title) => `<img src="${safeUrl(src)}" alt="${escapeHtml(alt)}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy" decoding="async">`);
  text = text.replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+["']([^"']*)["'])?\)/g,
    (_match, label, href, title) => `<a href="${safeUrl(href)}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer nofollow"' : ''}${title ? ` title="${escapeHtml(title)}"` : ''}>${label}</a>`);
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return text;
}

function renderMarkdownTable(lines: string[], start: number) {
  if (start + 1 >= lines.length) return null;
  const header = lines[start].trim();
  const separator = lines[start + 1].trim();
  if (!header.includes('|') || !/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(separator)) return null;

  const split = (value: string) => {
    let text = value.trim();
    if (text.startsWith('|')) text = text.slice(1);
    if (text.endsWith('|')) text = text.slice(0, -1);
    return text.split(/(?<!\\)\|/).map(cell => cell.replace(/\\\|/g, '|').trim());
  };

  const headers = split(header);
  const alignments = split(separator).map(cell =>
    cell.startsWith(':') && cell.endsWith(':') ? 'center' :
    cell.endsWith(':') ? 'left' : cell.startsWith(':') ? 'right' : '');
  const rows: string[] = [];
  let index = start + 2;

  while (index < lines.length && lines[index].trim().includes('|') && lines[index].trim() !== '') {
    const cells = split(lines[index]);
    rows.push(`<tr>${headers.map((_header, column) => {
      const style = alignments[column] ? ` style="text-align:${alignments[column]}"` : '';
      return `<td${style}>${inlineMarkdown(cells[column] ?? '')}</td>`;
    }).join('')}</tr>`);
    index++;
  }

  return {
    html: `<div class="article-table-wrapper"><table><thead><tr>${headers.map((_header, column) => {
      const style = alignments[column] ? ` style="text-align:${alignments[column]}"` : '';
      return `<th${style}>${inlineMarkdown(headers[column])}</th>`;
    }).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`,
    next: index
  };
}

export function renderMarkdownToHtml(markdown: string): string {
  const source = String(markdown ?? '').replace(/\r\n?/g, '\n').trim();
  if (!source) return '';
  if (/<(?:h[2-6]|p|ul|ol|table|blockquote|pre|div|iframe)\b/i.test(source)) {
    return sanitizeArticleHtml(source);
  }

  const lines = source.split('\n');
  const output: string[] = [];
  let index = 0;
  let paragraph: string[] = [];
  const flush = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(' ').trim();
    if (text) output.push(`<p>${inlineMarkdown(text)}</p>`);
    paragraph = [];
  };

  while (index < lines.length) {
    const line = lines[index];
    const table = renderMarkdownTable(lines, index);
    if (table) {
      flush();
      output.push(table.html);
      index = table.next;
      continue;
    }

    if (/^\s*```/.test(line)) {
      flush();
      const language = line.replace(/^\s*```/, '').trim();
      index++;
      const code: string[] = [];
      while (index < lines.length && !/^\s*```/.test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index++;
      const className = language ? ` class="language-${escapeHtml(language.replace(/[^a-zA-Z0-9_-]/g, ''))}"` : '';
      output.push(`<pre><code${className}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flush();
      const level = Math.min(heading[1].length + 1, 6);
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      index++;
      continue;
    }

    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flush();
      output.push('<hr>');
      index++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      flush();
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ''));
      output.push(`<blockquote><p>${inlineMarkdown(quote.join(' '))}</p></blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flush();
      const orderedList = Boolean(ordered);
      const items: string[] = [];
      while (index < lines.length) {
        const match = orderedList
          ? lines[index].match(/^\s*\d+[.)]\s+(.+)$/)
          : lines[index].match(/^\s*[-*+]\s+(.+)$/);
        if (!match) break;
        items.push(`<li>${inlineMarkdown(match[1])}</li>`);
        index++;
      }
      output.push(`<${orderedList ? 'ol' : 'ul'}>${items.join('')}</${orderedList ? 'ol' : 'ul'}>`);
      continue;
    }

    if (!line.trim()) {
      flush();
      index++;
      continue;
    }

    paragraph.push(line.trim());
    index++;
  }

  flush();
  return output.join('\n');
}
