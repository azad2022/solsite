import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'server.ts');
let source = readFileSync(file, 'utf8');

const secureAuthBlock = `// Production admin authentication: only the HttpOnly __Host-solmint_session cookie is accepted.\n  const authSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || \"\";\n  const authSupabase = authSupabaseKey && SUPABASE_URL\n    ? createClient(SUPABASE_URL, authSupabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })\n    : null;\n  const getSessionToken = (req: express.Request): string => {\n    const cookie = String(req.headers.cookie || \"\");\n    const match = cookie.match(/(?:^|;\\s*)__Host-solmint_session=([^;]+)/);\n    return match ? decodeURIComponent(match[1]) : \"\";\n  };\n  const getAuthenticatedAdmin = async (req: express.Request): Promise<any | null> => {\n    if (!authSupabase) return null;\n    const token = getSessionToken(req);\n    if (!token) return null;\n    const tokenHash = crypto.createHash(\"sha256\").update(token).digest(\"hex\");\n    const { data: sessions, error: sessionError } = await authSupabase.from(\"auth_sessions\").select(\"user_id,expires_at\").eq(\"token_hash\", tokenHash).limit(1);\n    if (sessionError || !sessions?.[0] || !sessions[0].expires_at || Date.parse(sessions[0].expires_at) <= Date.now()) return null;\n    const { data: users, error: userError } = await authSupabase.from(\"users\").select(\"id,username,full_name,role,permissions,is_active,created_at\").eq(\"id\", sessions[0].user_id).limit(1);\n    if (userError || !users?.[0] || users[0].is_active === false) return null;\n    const user = users[0];\n    if (![\"admin\", \"superadmin\"].includes(String(user.role))) return null;\n    await authSupabase.from(\"auth_sessions\").update({ last_seen_at: new Date().toISOString() }).eq(\"token_hash\", tokenHash).catch(() => {});\n    return user;\n  };\n  const isAuthorizedAdmin = async (req: express.Request): Promise<boolean> => Boolean(await getAuthenticatedAdmin(req));\n  const requireAdminAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {\n    try {\n      const user = await getAuthenticatedAdmin(req);\n      if (!user) return res.status(401).json({ success: false, message: \"نشست مدیریتی معتبر نیست یا منقضی شده است.\" });\n      (req as any).__authenticatedAdmin = user;\n      next();\n    } catch (error) {\n      console.error(\"Production authentication error:\", error);\n      return res.status(503).json({ success: false, message: \"سرویس احراز هویت در دسترس نیست.\" });\n    }\n  };`;

const startMarker = '  // Admin authentication check helper for sensitive API endpoints';
const endMarker = '  // Dedicated production cron authentication.';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker);
if (start !== -1 && end !== -1 && end > start) {
  source = source.slice(0, start) + secureAuthBlock + '\n\n' + source.slice(end);
}

const loginStart = source.indexOf('  app.post("/api/users/login"');
const updateStart = source.indexOf('  app.post("/api/users/update"', loginStart);
if (loginStart !== -1 && updateStart !== -1 && updateStart > loginStart) {
  const disabledLogin = `  // Legacy Express login is intentionally disabled. Production login is exclusively functions/api/users/login.ts.\n  app.post(\"/api/users/login\", (req, res) => res.status(410).json({ success: false, code: \"LEGACY_AUTH_DISABLED\", message: \"این مسیر احراز هویت قدیمی غیرفعال است.\" }));\n\n`;
  source = source.slice(0, loginStart) + disabledLogin + source.slice(updateStart);
}

source = source.replace(/solmint1404/g, 'REMOVED_LEGACY_CREDENTIAL');
writeFileSync(file, source, 'utf8');
console.log('✓ Server authentication hardened: HttpOnly host-prefixed session only; legacy login disabled.');
