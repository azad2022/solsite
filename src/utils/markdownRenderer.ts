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
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(value) && !/^(?:javascript|data|vbscript):/i.test(value)) return escapeHtml(value);
  return '#';
}

function isTrustedLiveChartSrc(raw: string): boolean {
  try {
    const url = new URL(raw, window.location.origin);
    return url.protocol === 'https:' && url.hostname === 'nvopkbiedorfshwbmyhn.supabase.co' && url.pathname === '/functions/v1/solana-live-chart';
  } catch { return false; }
}

function sanitizeArticleHtml(source: string): string {
  if (typeof DOMParser === 'undefined') return escapeHtml(source);
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const allowed = new Set(['H2','H3','H4','H5','H6','P','UL','OL','LI','STRONG','B','EM','I','DEL','S','BLOCKQUOTE','BR','HR','A','IMG','IFRAME','PRE','CODE','TABLE','THEAD','TBODY','TFOOT','TR','TH','TD']);
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName;
    if (!allowed.has(tag)) return Array.from(el.childNodes).map(walk).join('');
    if (tag === 'BR') return '<br>';
    if (tag === 'HR') return '<hr>';
    if (tag === 'IFRAME') {
      const srcRaw = el.getAttribute('src') || '';
      if (!isTrustedLiveChartSrc(srcRaw)) return '';
      return `<div class="article-live-chart" style="width:100%;margin:24px 0;border-radius:18px;overflow:hidden"><iframe src="${escapeHtml(srcRaw)}" title="نمودار زنده قیمت سولانا" loading="lazy" style="display:block;width:100%;height:470px;border:0" referrerpolicy="no-referrer"></iframe></div>`;
    }
    const children = Array.from(el.childNodes).map(walk).join('');
    if (tag === 'A') {
      const href = safeUrl(el.getAttribute('href') || '#');
      const external = /^https?:\/\//i.test(el.getAttribute('href') || '');
      return `<a href="${href}"${external ? ' target="_blank" rel="noopener noreferrer nofollow"' : ''}>${children}</a>`;
    }
    if (tag === 'IMG') {
      const src = safeUrl(el.getAttribute('src') || '#');
      const alt = escapeHtml(el.getAttribute('alt') || '');
      return `<img src="${src}" alt="${alt}" loading="lazy" decoding="async">`;
    }
    if (tag === 'TH' || tag === 'TD') {
      const colspan = Number(el.getAttribute('colspan'));
      const rowspan = Number(el.getAttribute('rowspan'));
      const attrs = `${Number.isInteger(colspan) && colspan >= 1 && colspan <= 20 ? ` colspan="${colspan}"` : ''}${Number.isInteger(rowspan) && rowspan >= 1 && rowspan <= 20 ? ` rowspan="${rowspan}"` : ''}`;
      return `<${tag.toLowerCase()}${attrs}>${children}</${tag.toLowerCase()}>`;
    }
    return `<${tag.toLowerCase()}>${children}</${tag.toLowerCase()}>`;
  };
  return Array.from(doc.body.childNodes).map(walk).join('');
}

function inlineMarkdown(value: string): string {
  let s = escapeHtml(value);
  s = s.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+[\"']([^\"']*)[\"'])?\)/g, (_m, alt, src, title) => `<img src="${safeUrl(src)}" alt="${escapeHtml(alt)}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy" decoding="async">`);
  s = s.replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+[\"']([^\"']*)[\"'])?\)/g, (_m, label, href, title) => `<a href="${safeUrl(href)}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer nofollow"' : ''}${title ? ` title="${escapeHtml(title)}"` : ''}>${label}</a>`);
  s = s.replace(/`([^`]+)`/g, (_m, code) => { if (/<table\b/i.test(code)) return sanitizeArticleHtml(code); return `<code>${code}</code>`; });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return s;
}

function renderMarkdownTable(lines: string[], start: number): { html: string; next: number } | null {
  if (start + 1 >= lines.length) return null;
  const header = lines[start].trim(); const separator = lines[start + 1].trim();
  if (!header.includes('|') || !/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(separator)) return null;
  const split = (line: string) => { let value=line.trim(); if(value.startsWith('|'))value=value.slice(1); if(value.endsWith('|'))value=value.slice(0,-1); return value.split(/(?<!\\)\|/).map(cell=>cell.replace(/\\\|/g,'|').trim()); };
  const headers=split(header); const alignments=split(separator).map(cell=>{const left=cell.startsWith(':');const right=cell.endsWith(':');return left&&right?'center':right?'left':left?'right':'';});
  const bodyRows:string[]=[]; let i=start+2;
  while(i<lines.length&&lines[i].trim().includes('|')&&lines[i].trim()!==''){const cells=split(lines[i]);bodyRows.push(`<tr>${headers.map((_h,index)=>{const align=alignments[index]?` style="text-align:${alignments[index]}"`:'';return `<td${align}>${inlineMarkdown(cells[index]??'')}</td>`;}).join('')}</tr>`);i++;}
  const headerHtml=headers.map((_h,index)=>{const align=alignments[index]?` style="text-align:${alignments[index]}"`:'';return `<th${align}>${inlineMarkdown(headers[index])}</th>`;}).join('');
  return {html:`<div class="article-table-wrapper"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyRows.join('')}</tbody></table></div>`,next:i};
}

export function renderMarkdownToHtml(markdown: string): string {
  const source=String(markdown??'').replace(/\r\n?/g,'\n').trim(); if(!source)return '';
  if(/<(?:h[2-6]|p|ul|ol|table|blockquote|pre|div|iframe)\b/i.test(source))return sanitizeArticleHtml(source);
  const lines=source.split('\n'); const out:string[]=[]; let i=0; let paragraph:string[]=[];
  const flushParagraph=()=>{if(!paragraph.length)return;const text=paragraph.join(' ').trim();if(text)out.push(`<p>${inlineMarkdown(text)}</p>`);paragraph=[];};
  while(i<lines.length){const line=lines[i]; const markdownTable=renderMarkdownTable(lines,i); if(markdownTable){flushParagraph();out.push(markdownTable.html);i=markdownTable.next;continue;}
    if(/^\s*```/.test(line)){flushParagraph();const language=line.replace(/^\s*```/,'').trim();i++;const code:string[]=[];while(i<lines.length&&!/^\s*```/.test(lines[i]))code.push(lines[i++]);if(i<lines.length)i++;const lang=language.replace(/[^a-zA-Z0-9_-]/g,'');const langClass=lang?` class="language-${escapeHtml(lang)}"`:'';const codeText=code.join('\n');if(/<table\b/i.test(codeText))out.push(sanitizeArticleHtml(codeText));else out.push(`<pre><code${langClass}>${escapeHtml(codeText)}</code></pre>`);continue;}
    const heading=line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);if(heading){flushParagraph();const level=Math.min(heading[1].length+1,6);out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);i++;continue;}
    if(/^\s*(---+|\*\*\*+)\s*$/.test(line)){flushParagraph();out.push('<hr>');i++;continue;}
    if(/^\s*>/.test(line)){flushParagraph();const quote:string[]=[];while(i<lines.length&&/^\s*>/.test(lines[i]))quote.push(lines[i++].replace(/^\s*>\s?/,''));out.push(`<blockquote><p>${inlineMarkdown(quote.join(' '))}</p></blockquote>`);continue;}
    const unordered=line.match(/^\s*[-*+]\s+(.+)$/);const ordered=line.match(/^\s*\d+[.)]\s+(.+)$/);if(unordered||ordered){flushParagraph();const orderedList=Boolean(ordered);const items:string[]=[];while(i<lines.length){const m=orderedList?lines[i].match(/^\s*\d+[.)]\s+(.+)$/):lines[i].match(/^\s*[-*+]\s+(.+)$/);if(!m)break;items.push(`<li>${inlineMarkdown(m[1])}</li>`);i++;}out.push(`<${orderedList?'ol':'ul'}>${items.join('')}</${orderedList?'ol':'ul'}>`);continue;}
    if(!line.trim()){flushParagraph();i++;continue;} paragraph.push(line.trim());i++;
  }
  flushParagraph(); return out.join('\n');
}
