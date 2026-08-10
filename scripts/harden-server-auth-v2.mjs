import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'server.ts');
let source = readFileSync(file, 'utf8');

const secureAuthBlock = `// Production admin authentication: only the HttpOnly __Host-solmint_session cookie is accepted.
  const authSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  const authSupabase = authSupabaseKey && SUPABASE_URL
    ? createClient(SUPABASE_URL, authSupabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  const getSessionToken = (req: express.Request): string => {
    const cookie = String(req.headers.cookie || "");
    const match = cookie.match(/(?:^|;\\s*)__Host-solmint_session=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  };
  const getAuthenticatedAdmin = async (req: express.Request): Promise<any | null> => {
    if (!authSupabase) return null;
    const token = getSessionToken(req);
    if (!token) return null;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const { data: sessions, error: sessionError } = await authSupabase.from("auth_sessions").select("user_id,expires_at").eq("token_hash", tokenHash).limit(1);
    if (sessionError || !sessions?.[0] || !sessions[0].expires_at || Date.parse(sessions[0].expires_at) <= Date.now()) return null;
    const { data: users, error: userError } = await authSupabase.from("users").select("id,username,full_name,role,permissions,is_active,created_at").eq("id", sessions[0].user_id).limit(1);
    if (userError || !users?.[0] || users[0].is_active === false) return null;
    const user = users[0];
    if (!["admin", "superadmin"].includes(String(user.role))) return null;
    await authSupabase.from("auth_sessions").update({ last_seen_at: new Date().toISOString() }).eq("token_hash", tokenHash).catch(() => {});
    return user;
  };
  const isAuthorizedAdmin = async (req: express.Request): Promise<boolean> => Boolean(await getAuthenticatedAdmin(req));
  const requireAdminAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const user = await getAuthenticatedAdmin(req);
      if (!user) return res.status(401).json({ success: false, message: "نشست مدیریتی معتبر نیست یا منقضی شده است." });
      (req as any).__authenticatedAdmin = user;
      next();
    } catch (error) {
      console.error("Production authentication error:", error);
      return res.status(503).json({ success: false, message: "سرویس احراز هویت در دسترس نیست." });
    }
  };`;

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
  const disabledLogin = `  // Legacy Express login is intentionally disabled. Production login is exclusively functions/api/users/login.ts.
  app.post("/api/users/login", (req, res) => res.status(410).json({ success: false, code: "LEGACY_AUTH_DISABLED", message: "این مسیر احراز هویت قدیمی غیرفعال است." }));

`;
  source = source.slice(0, loginStart) + disabledLogin + source.slice(updateStart);
}

// Remove duplicated markers left by older hardening passes.
source = source.replace(/(?:\\s*\\/\\/ Legacy Express login is intentionally disabled\\. Production login is exclusively functions\\/api\\/users\\/login\\.ts\\.\\n){2,}/g, '  // Legacy Express login is intentionally disabled. Production login is exclusively functions/api/users/login.ts.\n');

// Registration must be admin-only and passwords must be hashed on the server.
const registerStart = source.indexOf('  app.post("/api/users/register"');
const loginMarker = source.indexOf('  // Legacy Express login is intentionally disabled.', registerStart);
if (registerStart !== -1 && loginMarker !== -1 && loginMarker > registerStart) {
  const secureRegister = [
    '  app.post("/api/users/register", requireAdminAuth, async (req, res) => {',
    '    try {',
    '      const { username, fullName, password, role, permissions, isActive } = req.body || {};',
    '      const cleanUsername = String(username || "").trim();',
    '      const cleanFullName = String(fullName || "").trim();',
    '      const cleanPassword = String(password || "").trim();',
    '      if (!cleanUsername || !cleanFullName || cleanPassword.length < 8) {',
    '        return res.status(400).json({ success: false, message: "نام کاربری، نام کامل و رمز عبور حداقل ۸ کاراکتری الزامی است." });',
    '      }',
    '      const salt = crypto.randomBytes(16);',
    '      const derived = crypto.scryptSync(cleanPassword, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });',
    '      const passwordHash = `scrypt$16384$8$1$${salt.toString("base64url")}$${derived.toString("base64url")}`;',
    '      const defaultPerms = role === "admin" || role === "superadmin"',
    '        ? ["articles", "editor", "comments", "media", "seo", "audit", "redirects", "downloads", "deepseek", "chatbot", "database", "security", "users"]',
    '        : ["articles", "editor", "comments", "media"];',
    '      const newUser = {',
    '        id: "usr-" + Date.now(),',
    '        username: cleanUsername,',
    '        fullName: cleanFullName,',
    '        passwordHash,',
    '        role: role || "user",',
    '        permissions: Array.isArray(permissions) && permissions.length > 0 ? permissions : defaultPerms,',
    '        isActive: typeof isActive === "boolean" ? isActive : true,',
    '        createdAt: new Date().toLocaleDateString("fa-IR")',
    '      };',
    '      const result = registerUser(newUser as any);',
    '      if (!result.success) return res.status(400).json(result);',
    '      if (serverSupabase) {',
    '        const { error } = await serverSupabase.from("users").upsert({',
    '          id: newUser.id, username: newUser.username, full_name: newUser.fullName, password_hash: newUser.passwordHash,',
    '          role: newUser.role, permissions: newUser.permissions, is_active: newUser.isActive',
    '        }, { onConflict: "username" });',
    '        if (error) return res.status(500).json({ success: false, message: "ذخیره کاربر در دیتابیس انجام نشد." });',
    '      }',
    '      return res.json(result);',
    '    } catch (err: any) {',
    '      return res.status(500).json({ success: false, message: err.message });',
    '    }',
    '  });',
    '',
  ].join('\n');
  source = source.slice(0, registerStart) + secureRegister + source.slice(loginMarker);
}

// Password changes through the legacy Express API must also use the same server-side scrypt format.
source = source.replace(/if \(passwordHash\) \{[\s\S]*?\} else if \(password\) \{\s*users\[idx\]\.passwordHash = hashString\(String\(password\)\);\s*\}/, [
  'if (password) {',
  '        const cleanPassword = String(password).trim();',
  '        if (cleanPassword.length < 8) return res.status(400).json({ success: false, message: "رمز عبور باید حداقل ۸ کاراکتر باشد." });',
  '        const salt = crypto.randomBytes(16);',
  '        const derived = crypto.scryptSync(cleanPassword, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });',
  '        users[idx].passwordHash = `scrypt$16384$8$1$${salt.toString("base64url")}$${derived.toString("base64url")}`;',
  '      }'
].join('\n'));

source = source.replace(/solmint1404/g, 'REMOVED_LEGACY_CREDENTIAL');
writeFileSync(file, source, 'utf8');
console.log('✓ Server authentication hardened: HttpOnly session only, legacy login disabled, admin-only user creation, server-side scrypt passwords.');
