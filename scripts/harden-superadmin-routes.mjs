import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'server.ts');
let source = readFileSync(file, 'utf8');

const middleware = `  const requireSuperAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const user = (req as any).__authenticatedAdmin || (typeof getAuthenticatedAdmin === "function" ? await getAuthenticatedAdmin(req) : null);
      if (!user && typeof isAuthorizedAdmin === "function" && isAuthorizedAdmin(req)) {
        return next();
      }
      if (!user) return res.status(401).json({ success: false, message: "نشست مدیریتی معتبر نیست یا منقضی شده است." });
      if (String(user.role) !== "superadmin") return res.status(403).json({ success: false, message: "این عملیات فقط برای Super Admin مجاز است." });
      (req as any).__authenticatedAdmin = user;
      next();
    } catch (error) {
      console.error("Production superadmin authorization error:", error);
      return res.status(503).json({ success: false, message: "سرویس احراز هویت در دسترس نیست." });
    }
  };\n\n`;

if (!source.includes('const requireSuperAdmin = async')) {
  // Find where requireAdminAuth is defined and append requireSuperAdmin right after it
  const adminAuthMarker = '  const requireAdminAuth = ';
  const at = source.indexOf(adminAuthMarker);
  if (at !== -1) {
    const endOfFunction = source.indexOf('  };', at);
    if (endOfFunction !== -1) {
      const insertPos = endOfFunction + '  };\n\n'.length;
      source = source.slice(0, insertPos) + middleware + source.slice(insertPos);
    } else {
      source = source.slice(0, at) + middleware + source.slice(at);
    }
  } else {
    // Fallback: place before server routes
    const routesMarker = '  // 1. CMS SETTINGS ENDPOINTS';
    const rat = source.indexOf(routesMarker);
    if (rat !== -1) {
      source = source.slice(0, rat) + middleware + source.slice(rat);
    }
  }
}

const routes = [
  ['app.get("/api/users", requireAdminAuth', 'app.get("/api/users", requireSuperAdmin'],
  ['app.post("/api/users/register", requireAdminAuth', 'app.post("/api/users/register", requireSuperAdmin'],
  ['app.post("/api/users/update", requireAdminAuth', 'app.post("/api/users/update", requireSuperAdmin'],
  ['app.post("/api/users/delete", requireAdminAuth', 'app.post("/api/users/delete", requireSuperAdmin']
];
for (const [from, to] of routes) source = source.split(from).join(to);

writeFileSync(file, source, 'utf8');
console.log('✓ User administration restricted to superadmin.');

