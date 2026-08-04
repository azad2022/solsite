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
    (_m, alt, src, title) => `<img src="${safeUrl(src)}" alt="${escapeHtml(alt)}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy" decoding="async">`);
  s = s.replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+[\"']([^\"']*)[\"'])?\)/g,
    (_m, label, href, title) => `<a href="${safeUrl(href)}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer nofollow"' : ''}${title ? ` title="${escapeHtml(title)}"` : ''}>${label}</a>`);
  s = s.replace(/`([^`]+)`/g, (_m, code) => {
    // DeepSeek and the admin editor may produce a complete HTML table inside
    // inline backticks. Treat that specific structure as article content,
    // not executable HTML. Everything else remains normal inline code.
    if (/<table\b/i.test(code)) return renderHtmlTable(code);
    return `<code>${code}</code>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return s;
}

function cleanTableCell(value: string): string {
  // HTML tables are converted to a controlled semantic representation.
  // Attributes, styles, scripts and event handlers are never copied through.
  const text = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return inlineMarkdown(text);
}

function tableSpan(attrs: string, name: 'colspan' | 'rowspan'): string {
  const match = attrs.match(new RegExp(`${name}\\s*=\\s*[\"']?(\\d+)[\"']?`, 'i'));
  if (!match) return '';
  const value = Math.max(1, Math.min(20, Number(match[1])));
  return ` ${name}="${value}"`;
}

function renderHtmlTable(html: string): string {
  const tableMatch = html.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return `<code>${escapeHtml(html)}</code>`;

  const tableBody = tableMatch[1];
  const rows = Array.from(tableBody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));
  if (!rows.length) return `<code>${escapeHtml(html)}</code>`;

  const renderedRows = rows.map(row => {
    const cells = Array.from(row[1].matchAll(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi));
    if (!cells.length) return '';
    const cellsHtml = cells.map(cell => {
      const tag = cell[1].toLowerCase() === 'th' ? 'th' : 'td';
      const attrs = `${tableSpan(cell[2], 'colspan')}${tableSpan(cell[2], 'rowspan')}`;
      return `<${tag}${attrs}>${cleanTableCell(cell[3])}</${tag}>`;
    }).join('');
    return `<tr>${cellsHtml}</tr>`;
  }).filter(Boolean);

  if (!renderedRows.length) return `<code>${escapeHtml(html)}</code>`;

  // Preserve the author's thead/tbody distinction where it can be inferred.
  const hasThead = /<thead\b/i.test(tableBody);
  const firstRow = renderedRows[0];
  const restRows = renderedRows.slice(1).join('');
  const table = hasThead
    ? `<table><thead>${firstRow}</thead><tbody>${restRows}</tbody></table>`
    : `<table>${renderedRows.join('')}</table>`;

  return `<div class="article-table-wrapper">${table}</div>`;
}

function renderMarkdownTable(lines: string[], start: number): { html: string; next: number } | null {
  if (start + 1 >= lines.length) return null;
  const header = lines[start].trim();
  const separator = lines[start + 1].trim();
  if (!header.includes('|') || !/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(separator)) return null;

  const split = (line: string) => {
    let value = line.trim();
    if (value.startsWith('|')) value = value.slice(1);
    if (value.endsWith('|')) value = value.slice(0, -1);
    return value.split(/(?<!\\)\|/).map(cell => cell.replace(/\\\|/g, '|').trim());
  };

  const headers = split(header);
  const alignments = split(separator).map(cell => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    return left && right ? 'center' : right ? 'left' : left ? 'right' : '';
  });

  const bodyRows: string[] = [];
  let i = start + 2;
  while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
    const cells = split(lines[i]);
    bodyRows.push(`<tr>${headers.map((_h, index) => {
      const align = alignments[index] ? ` style="text-align:${alignments[index]}"` : '';
      return `<td${align}>${inlineMarkdown(cells[index] ?? '')}</td>`;
    }).join('')}</tr>`);
    i++;
  }

  const headerHtml = headers.map((_h, index) => {
    const align = alignments[index] ? ` style="text-align:${alignments[index]}"` : '';
    return `<th${align}>${inlineMarkdown(headers[index])}</th>`;
  }).join('');

  return {
    html: `<div class="article-table-wrapper"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyRows.join('')}</tbody></table></div>`,
    next: i
  };
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

    const markdownTable = renderMarkdownTable(lines, i);
    if (markdownTable) {
      flushParagraph();
      out.push(markdownTable.html);
      i = markdownTable.next;
      continue;
    }

    // Support safe, semantic HTML tables generated by the AI writer. We do
    // not render arbitrary HTML: only the table structure is extracted and
    // rebuilt from a strict allowlist of table elements.
    if (/^\s*<(?:div[^>]*>\s*)?<table\b/i.test(line)) {
      flushParagraph();
      const htmlLines: string[] = [line];
      i++;
      while (i < lines.length) {
        htmlLines.push(lines[i]);
        if (/<\/table>/i.test(lines[i])) { i++; break; }
        i++;
      }
      out.push(renderHtmlTable(htmlLines.join('\n')));
      continue;
    }

    if (/^\s*```/.test(line)) {
      flushParagraph();
      const language = line.replace(/^\s*```/, '').trim();
      i++;
      const code: string[] = [];
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      const lang = language.replace(/[^a-zA-Z0-9_-]/g, '');
      const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      const codeText = code.join('\n');
      // If a fenced block is actually an HTML table, render the table as
      // article content; genuine code blocks remain code blocks.
      if (/<table\b/i.test(codeText)) out.push(renderHtmlTable(codeText));
      else out.push(`<pre><code${langClass}>${escapeHtml(codeText)}</code></pre>`);
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
