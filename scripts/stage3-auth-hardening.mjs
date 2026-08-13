import fs from 'node:fs';

function read(path) { if (!fs.existsSync(path)) throw new Error(`[stage3-auth] Missing ${path}`); return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content, 'utf8'); }

{
  const path = 'functions/api/article-categories.ts';
  let source = read(path);
  const hasModernAuth = source.includes('getAuthenticatedUser') && source.includes("['admin', 'superadmin']");
  if (!hasModernAuth) {
    if (!source.includes("import { getAuthenticatedUser, jsonResponse } from './auth/_shared';")) source = source.replace("type Env = {", "import { getAuthenticatedUser, jsonResponse } from './auth/_shared';\n\ntype Env = {");
    source = source.replace(/\nconst suppliedPasscode = \(request: Request\) =>[\s\S]*?\n/,'\n');
    source = source.replace(/\nasync function adminAuthorized\(request: Request, env: Env\): Promise<boolean> \{[\s\S]*?\n\}\n(?=function cleanCategory)/, "\nasync function requireAdmin(request: Request, env: Env) { const actor = await getAuthenticatedUser(env, request); return actor && ['admin', 'superadmin'].includes(String(actor.role)) ? actor : null; }\n\n");
    source = source.replace(/const includeInactive = new URL\(request\.url\)\.searchParams\.get\('includeInactive'\) === 'true';/, "const includeInactive = new URL(request.url).searchParams.get('includeInactive') === 'true';\n      if (includeInactive && !(await requireAdmin(request, env))) return json({ success: false, message: 'دسترسی مدیر معتبر نیست.' }, 401);");
    source = source.replace(/if \(!\(await adminAuthorized\(request, env\)\)\) return json\(\{ success: false, message: 'دسترسی مدیریت دسته‌بندی‌ها غیرمجاز است\.' \}, 401\);/, "if (!(await requireAdmin(request, env))) return json({ success: false, message: 'دسترسی مدیر غیرمجاز است.' }, 401);");
    write(path, source);
  }
  source = read(path);
  if (source.includes("localStorage.getItem('solmint_admin_passcode')") || source.includes('x-admin-passcode')) throw new Error('[stage3-auth] Category API still consumes legacy passcode authorization.');
  if (!source.includes('getAuthenticatedUser') || !source.includes("['admin', 'superadmin']")) throw new Error('[stage3-auth] Category API session RBAC invariant failed.');
  console.log('✓ [stage3-auth] Category API uses session RBAC.');
}

{
  const path = 'src/components/ArticleCategoryManager.tsx';
  let source = read(path);
  const modern = "const authHeaders = (): Record<string, string> => ({ 'Content-Type': 'application/json' });";
  const authStart = source.indexOf('const authHeaders =');
  if (authStart >= 0) {
    const authEnd = source.indexOf('\n};', authStart);
    if (authEnd < 0) throw new Error('[stage3-auth] Could not locate Category Manager auth helper terminator.');
    source = `${source.slice(0, authStart)}${modern}${source.slice(authEnd + 3)}`;
  }
  source = source.replace(/\n?\s*const passcode = \(localStorage\.getItem\(['"]solmint_admin_passcode['"]\)[\s\S]*?\n\s*return \{ 'Content-Type': 'application\/json'[\s\S]*?\n\s*\};?/g, '');
  if (source.includes('solmint_admin_passcode') || source.includes('x-admin-passcode')) throw new Error('[stage3-auth] Category Manager still contains legacy passcode authorization.');
  write(path, source);
  console.log('✓ [stage3-auth] Category Manager no longer reads admin credentials from localStorage.');
}

console.log('✓ [stage3-auth] Category CMS authentication hardening passed.');
