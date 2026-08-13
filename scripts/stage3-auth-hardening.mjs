import fs from 'node:fs';

function read(path) { if (!fs.existsSync(path)) throw new Error(`[stage3-auth] Missing ${path}`); return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content, 'utf8'); }
function replaceOnce(path, source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`[stage3-auth] Anchor not found: ${label}`);
  return source.replace(from, to);
}

{
  const path = 'functions/api/article-categories.ts';
  let source = read(path);
  if (!source.includes("getAuthenticatedUser") || !source.includes("['admin', 'superadmin']")) {
    source = source.replace("type Category = {", "import { getAuthenticatedUser, jsonResponse } from './auth/_shared';\n\ntype Category = {");
    source = source.replace("const suppliedPasscode = (request: Request) => (request.headers.get('x-admin-passcode') || request.headers.get('authorization')?.replace(/^Bearer\\s+/i, '') || '').trim();\n", '');
    source = source.replace(/const adminAuthorized = async[\s\S]*?\n}\n(?=function cleanCategory)/, "async function requireAdmin(request: Request, env: Env) { const actor = await getAuthenticatedUser(env, request); return actor && ['admin', 'superadmin'].includes(String(actor.role)) ? actor : null; }\n\n");
    source = source.replace(/if \(method === 'GET'\) \{/, "if (method === 'GET') {");
    source = source.replace(/const includeInactive = new URL\(request\.url\)\.searchParams\.get\('includeInactive'\) === 'true';/, "const includeInactive = new URL(request.url).searchParams.get('includeInactive') === 'true';\n      if (includeInactive && !(await requireAdmin(request, env))) return json({ success: false, message: 'دسترسی مدیر معتبر نیست.' }, 401);");
    source = source.replace(/if \(!\(await adminAuthorized\(request, env\)\)\) return json\(\{ success: false, message: 'دسترسی مدیریت دسته‌بندی‌ها غیرمجاز است\.' \}, 401\);/, "if (!(await requireAdmin(request, env))) return json({ success: false, message: 'دسترسی مدیر غیرمجاز است.' }, 401);");
    write(path, source);
  }

  source = read(path);
  if (source.includes('x-admin-passcode') || source.includes('solmint_admin_passcode') || source.includes('ADMIN_PASSCODE')) throw new Error('[stage3-auth] Category API still contains legacy passcode authorization.');
  if (!source.includes('getAuthenticatedUser') || !source.includes("['admin', 'superadmin']")) throw new Error('[stage3-auth] Category API session RBAC invariant failed.');
  console.log('✓ [stage3-auth] Category API uses session RBAC.');
}

{
  const path = 'src/components/ArticleCategoryManager.tsx';
  let source = read(path);
  const legacy = "const authHeaders = (): Record<string, string> => {\n  const passcode = (localStorage.getItem('solmint_admin_passcode') || '').trim();\n  return { 'Content-Type': 'application/json', ...(passcode ? { 'x-admin-passcode': passcode, Authorization: `Bearer ${passcode}` } : {}) };\n};";
  const modern = "const authHeaders = (): Record<string, string> => ({ 'Content-Type': 'application/json' });";
  source = replaceOnce(path, source, legacy, modern, 'legacy category auth helper');
  source = read(path);
  if (source.includes('solmint_admin_passcode') || source.includes('x-admin-passcode')) throw new Error('[stage3-auth] Category Manager still contains legacy passcode authorization.');
  write(path, source);
  console.log('✓ [stage3-auth] Category Manager no longer reads admin credentials from localStorage.');
}

console.log('✓ [stage3-auth] Category CMS authentication hardening passed.');
