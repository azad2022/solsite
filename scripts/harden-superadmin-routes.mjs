import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'server.ts');
let source = readFileSync(file, 'utf8');

const marker = '  // Dedicated production cron authentication.';
const middleware = `  const requireSuperAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {\n    try {\n      const user = (req as any).__authenticatedAdmin || await getAuthenticatedAdmin(req);\n      if (!user) return res.status(401).json({ success: false, message: \"نشست مدیریتی معتبر نیست یا منقضی شده است.\" });\n      if (String(user.role) !== \"superadmin\") return res.status(403).json({ success: false, message: \"این عملیات فقط برای Super Admin مجاز است.\" });\n      (req as any).__authenticatedAdmin = user;\n      next();\n    } catch (error) {\n      console.error(\"Production superadmin authorization error:\", error);\n      return res.status(503).json({ success: false, message: \"سرویس احراز هویت در دسترس نیست.\" });\n    }\n  };\n\n`;
if (!source.includes('const requireSuperAdmin = async')) {
  const at = source.indexOf(marker);
  if (at === -1) throw new Error('Superadmin hardening failed: auth middleware marker not found');
  source = source.slice(0, at) + middleware + source.slice(at);
}

const routes = [
  ['app.get("/api/users", requireAdminAuth', 'app.get("/api/users", requireSuperAdmin'],
  ['app.post("/api/users/register", requireAdminAuth', 'app.post("/api/users/register", requireSuperAdmin'],
  ['app.post("/api/users/update", requireAdminAuth', 'app.post("/api/users/update", requireSuperAdmin'],
  ['app.post("/api/users/delete", requireAdminAuth', 'app.post("/api/users/delete", requireSuperAdmin']
];
for (const [from, to] of routes) source = source.split(from).join(to);

for (const markerText of [
  'app.get("/api/users", requireSuperAdmin',
  'app.post("/api/users/register", requireSuperAdmin',
  'app.post("/api/users/update", requireSuperAdmin',
  'app.post("/api/users/delete", requireSuperAdmin'
]) {
  if (!source.includes(markerText)) throw new Error(`Superadmin hardening failed: ${markerText}`);
}

writeFileSync(file, source, 'utf8');
console.log('✓ User administration restricted to superadmin.');
