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
    "permissions: ['articles', 'editor', 'comments', 'media']",
    'permissions: []'
  );
  if (source.includes("permissions: ['articles', 'editor', 'comments', 'media']")) throw new Error('[stage2-hardening] Public registration still grants privileged permissions.');
  if (!source.includes('permissions: []')) throw new Error('[stage2-hardening] Public registration must explicitly initialize permissions to an empty array.');
  write(path, source);
}

// Security invariant: user password changes must use the managed password hasher, not raw SHA-256.
{
  const path = 'functions/api/users/update.ts';
  let source = read(path);
  if (!source.includes('hashPassword')) {
    source = source.replace(
      "import { getAuthenticatedUser, type Env, jsonResponse } from '../auth/_shared';",
      "import { getAuthenticatedUser, hashPassword, type Env, jsonResponse } from '../auth/_shared';"
    );
  }
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

// Canonicalize the SSR Markdown renderer to prevent Stage 1 simplification regressions.
{
  const path = 'functions/article/[slug].ts';
  let source = read(path);
  const renderer = read('scripts/article-rich-renderer.txt').trim();
  const start = source.indexOf('function renderBody(');
  const end = source.indexOf('function setMeta(', start);
  if (start < 0 || end < 0 || end <= start) throw new Error('[stage2-hardening] Could not locate SSR renderBody/setMeta anchors.');
  source = `${source.slice(0, start)}${renderer}\n${source.slice(end)}`;
  if (!source.includes('function inlineMarkdown(') || !source.includes('function renderBody(')) {
    throw new Error('[stage2-hardening] SSR Markdown renderer invariant failed.');
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
