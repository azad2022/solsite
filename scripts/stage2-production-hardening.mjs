import fs from 'node:fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`[stage2-hardening] Missing ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

// Security invariant: public registration must never grant editorial/admin permissions.
{
  const path = 'functions/api/users/register.ts';
  let source = read(path);
  source = source.replace(
    "const user = { id: `usr-${crypto.randomUUID()}`, username, full_name: fullName, password_hash: passwordHash, role: 'user', permissions: ['articles', 'editor', 'comments', 'media'], is_active: true };",
    "const user = { id: `usr-${crypto.randomUUID()}`, username, full_name: fullName, password_hash: passwordHash, role: 'user', permissions: [], is_active: true };"
  );
  if (source.includes("permissions: ['articles', 'editor', 'comments', 'media']")) throw new Error('[stage2-hardening] Public registration still grants privileged permissions.');
  if (!source.includes('permissions: []')) throw new Error('[stage2-hardening] Public registration must explicitly initialize permissions to an empty array.');
  write(path, source);
}

// Security invariant: user password changes must use the managed password hasher, not raw SHA-256.
{
  const path = 'functions/api/users/update.ts';
  let source = read(path);
  source = source.replace(
    "import { getAuthenticatedUser, type Env, jsonResponse } from '../auth/_shared';",
    "import { getAuthenticatedUser, hashPassword, type Env, jsonResponse } from '../auth/_shared';"
  );
  source = source.replace(
    "patch.password_hash = await sha256(body.password);",
    "patch.password_hash = await hashPassword(body.password);"
  );
  source = source.replace(
    /\nasync function sha256\(value: string\): Promise<string> \{[\s\S]*?\n\}\n/,
    '\n'
  );
  if (source.includes('patch.password_hash = await sha256(')) throw new Error('[stage2-hardening] User update still hashes passwords with raw SHA-256.');
  if (!source.includes('patch.password_hash = await hashPassword(')) throw new Error('[stage2-hardening] User update must use hashPassword().');
  write(path, source);
}

// Restore the richer SSR Markdown renderer if stage 1's simplified renderer is present.
{
  const path = 'functions/article/[slug].ts';
  let source = read(path);
  const simplified = /function renderBody\(value: string\) \{[\s\S]*?return out\.join\('\\n'\);\n\}/;
  if (simplified.test(source)) {
    const renderer = `function inlineMarkdown(value: string): string {\n  let s = escapeHtml(value);\n  s = s.replace(/!\\[([^\\]]*)\\]\\(([^\\s)]+)\\)/g, (_m, alt, src) => \`<img src="\${escapeHtml(safeUrl(src))}" alt="\${escapeHtml(alt)}" loading="lazy" decoding="async">\`);\n  s = s.replace(/\\[([^\\]]+)\\]\\(([^\\s)]+)\\)/g, (_m, label, href) => \`<a href="\${escapeHtml(safeUrl(href))}"\${/^https?:\\/\\//i.test(href) ? ' target="_blank" rel="noopener noreferrer nofollow"' : ''}>\${label}</a>\`);\n  s = s.replace(/\\`([^\\`]+)\\`/g, '<code>$1</code>');\n  s = s.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');\n  s = s.replace(/\\*([^*]+)\\*/g, '<em>$1</em>').replace(/_([^_]+)_/g, '<em>$1</em>');\n  return s;\n}\n\nfunction renderBody(source: string): string {\n  const normalized = String(source || '').replace(/\\r\\n?/g, '\\n').trim();\n  if (!normalized) return '';\n  const lines = normalized.split('\\n');\n  const output: string[] = [];\n  let paragraph: string[] = [];\n  const flush = () => {\n    if (!paragraph.length) return;\n    const text = paragraph.join(' ').trim();\n    if (text) output.push(\`<p>\${inlineMarkdown(text)}</p>\`);\n    paragraph = [];\n  };\n  let i = 0;\n  while (i < lines.length) {\n    const line = lines[i].trim();\n    const heading = line.match(/^#{1,6}\\s+(.+?)\\s*#*$/);\n    if (heading) {\n      flush();\n      const rawLevel = line.match(/^(#{1,6})/)?.[1].length || 2;\n      const level = Math.min(Math.max(rawLevel + 1, 2), 6);\n      output.push(\`<h\${level}>\${inlineMarkdown(heading[1])}</h\${level}>\`);\n      i++; continue;\n    }\n    if (/^\\s*[-*+]\\s+/.test(line)) {\n      flush(); const items = [];\n      while (i < lines.length && /^\\s*[-*+]\\s+/.test(lines[i].trim())) { items.push(\`<li>\${inlineMarkdown(lines[i].trim().replace(/^[-*+]\\s+/, ''))}</li>\`); i++; }\n      output.push(\`<ul>\${items.join('')}</ul>\`); continue;\n    }\n    if (/^\\s*\\d+[.)]\\s+/.test(line)) {\n      flush(); const items = [];\n      while (i < lines.length && /^\\s*\\d+[.)]\\s+/.test(lines[i].trim())) { items.push(\`<li>\${inlineMarkdown(lines[i].trim().replace(/^\\d+[.)]\\s+/, ''))}</li>\`); i++; }\n      output.push(\`<ol>\${items.join('')}</ol>\`); continue;\n    }\n    if (!line) { flush(); i++; continue; }\n    paragraph.push(line); i++;\n  }\n  flush();\n  return output.join('\\n');\n}`;
    source = source.replace(simplified, renderer);
  }
  if (!source.includes('function inlineMarkdown(')) throw new Error('[stage2-hardening] SSR Markdown renderer invariant failed.');
  if (source.includes("headers.set('Cache-Control'")) {
    // Existing stage 1 cache behavior is retained.
  }
  write(path, source);
}

// Comment moderation must remain explicitly authorized by role or comments permission.
{
  const source = read('functions/api/comments/approve.ts');
  if (!source.includes("permissions.includes('comments')")) throw new Error('[stage2-hardening] Comment moderation authorization invariant failed.');
}

// Media gateway must enforce the same RBAC contract at the application layer.
{
  const source = read('functions/api/media/[action].ts');
  if (!source.includes("permissions.includes('media')")) throw new Error('[stage2-hardening] Media authorization invariant failed.');
}

console.log('✓ [stage2-hardening] Auth, media, comments and SSR invariants verified.');
