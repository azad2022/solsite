import fs from 'fs';

const root = process.cwd();
const serverPath = `${root}/server.ts`;
const storePath = `${root}/src/utils/serverDataStore.ts`;
const clientPath = `${root}/src/utils/cmsApiClient.ts`;

function replaceOnce(text, pattern, replacement, label) {
  const next = text.replace(pattern, replacement);
  if (next === text) throw new Error(`Auth repair failed: ${label}`);
  return next;
}

let server = fs.readFileSync(serverPath, 'utf8');

const authHelpers = `  // Production admin authentication: signed HttpOnly server session.
  const SESSION_COOKIE = "solmint_admin_session";
  const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSCODE || crypto.randomBytes(32).toString("hex");

  function b64url(input: string): string {
    return Buffer.from(input).toString("base64url");
  }

  function signSession(payload: string): string {
    return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  }

  function createAdminSession(user: any): string {
    const payload = b64url(JSON.stringify({
      sub: String(user.id),
      username: String(user.username),
      role: String(user.role || "user"),
      exp: Date.now() + 2 * 60 * 60 * 1000
    }));
    return `${payload}.${signSession(payload)}`;
  }

  function verifyAdminSession(token: string): any | null {
    try {
      const [payload, signature] = String(token || "").split(".");
      if (!payload || !signature) return null;
      const expected = signSession(payload);
      if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (!parsed?.sub || !parsed?.username || !parsed?.exp || Date.now() >= Number(parsed.exp)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function readSessionCookie(req: express.Request): string {
    const raw = String(req.headers.cookie || "");
    const match = raw.match(/(?:^|;\s*)solmint_admin_session=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString("base64url");
    const derived = crypto.scryptSync(password, Buffer.from(salt, "base64url"), 64, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 32 * 1024 * 1024
    });
    return `scrypt$16384$8$1$${salt}$${derived.toString("base64url")}`;
  }

  function verifyPassword(password: string, stored: string): boolean {
    if (!password || !stored) return false;
    if (stored.startsWith("scrypt$")) {
      try {
        const [, n, r, p, salt, encoded] = stored.split("$");
        const derived = crypto.scryptSync(password, Buffer.from(salt, "base64url"), 64, {
          N: Number(n),
          r: Number(r),
          p: Number(p),
          maxmem: 32 * 1024 * 1024
        });
        const expected = Buffer.from(encoded, "base64url");
        return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
      } catch {
        return false;
      }
    }
    // One-way compatibility check for old SHA-256 records. New passwords are scrypt.
    return crypto.createHash("sha256").update(password).digest("hex") === stored;
  }

  async function findAuthUser(username: string): Promise<any | null> {
    const clean = String(username || "").trim().toLowerCase();
    if (!clean) return null;

    if (serverSupabase) {
      try {
        const { data, error } = await serverSupabase
          .from("users")
          .select("id, username, full_name, password_hash, role, permissions, is_active, created_at")
          .eq("username", clean)
          .maybeSingle();
        if (!error && data) return data;
      } catch (err) {
        console.warn("Supabase auth lookup failed:", err);
      }
    }

    // Local records remain available only as a migration bridge for existing accounts.
    const local = getAllUsers().find(u => u.username.toLowerCase() === clean);
    return local || null;
  }

  const isAuthorizedAdmin = (req: express.Request): boolean => {
    const session = verifyAdminSession(readSessionCookie(req));
    return Boolean(session && ["superadmin", "admin", "editor", "writer"].includes(String(session.role)));
  };

  const requireAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!isAuthorizedAdmin(req)) {
      return res.status(401).json({
        success: false,
        message: "نشست احراز هویت معتبر نیست یا منقضی شده است."
      });
    }
    next();
  };

`;

server = replaceOnce(
  server,
  /  \/\/ Admin authentication check helper for sensitive API endpoints[\s\S]*?  const requireAdminAuth = \(req: express\.Request, res: express\.Response, next: express\.NextFunction\) => \{[\s\S]*?  \};\n\n/,
  authHelpers,
  "server authentication middleware"
);

const loginRoute = `  app.post("/api/users/login", async (req, res) => {
    try {
      const { username, passcode, password } = req.body || {};
      const cleanUsername = String(username || "").trim().toLowerCase();
      const suppliedPassword = String(password || passcode || "");

      if (!cleanUsername || !suppliedPassword) {
        return res.status(400).json({ success: false, message: "نام کاربری و رمز عبور الزامی است." });
      }

      const user = await findAuthUser(cleanUsername);
      if (!user || user.is_active === false || user.isActive === false) {
        return res.status(401).json({ success: false, message: "نام کاربری یا رمز عبور اشتباه است." });
      }

      const storedHash = String(user.password_hash || user.passwordHash || "");
      if (!verifyPassword(suppliedPassword, storedHash)) {
        return res.status(401).json({ success: false, message: "نام کاربری یا رمز عبور اشتباه است." });
      }

      const normalizedUser = {
        id: String(user.id),
        username: String(user.username),
        fullName: String(user.full_name || user.fullName || ""),
        role: user.role || "user",
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
        isActive: user.is_active !== false && user.isActive !== false,
        createdAt: user.created_at || user.createdAt || new Date().toISOString()
      };

      const sessionToken = createAdminSession(normalizedUser);
      res.cookie(SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 2 * 60 * 60 * 1000
      });

      return res.json({
        success: true,
        user: normalizedUser,
        isSuperAdmin: normalizedUser.role === "superadmin"
      });
    } catch (err: any) {
      console.error("Admin login error:", err);
      return res.status(500).json({ success: false, message: "خطای داخلی در سرویس احراز هویت." });
    }
  });

  app.post("/api/users/logout", (req, res) => {
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/"
    });
    return res.json({ success: true });
  });

`;
server = replaceOnce(
  server,
  /  app\.post\("\/api\/users\/login"[\s\S]*?\n  \}\);\n\n  app\.post\("\/api\/users\/update"/,
  loginRoute + '  app.post("/api/users/update"',
  "login endpoint"
);

server = replaceOnce(
  server,
  /const finalHash = passInput\.length === 64 \? passInput : hashString\(passInput\);/,
  'const finalHash = hashPassword(passInput);',
  "registration password hashing"
);

server = replaceOnce(
  server,
  /if \(passwordHash\) \{\n        users\[idx\]\.passwordHash = String\(passwordHash\);\n      \} else if \(password\) \{\n        users\[idx\]\.passwordHash = hashString\(String\(password\)\);\n      \}/,
  `if (passwordHash) {
        users[idx].passwordHash = String(passwordHash);
      } else if (password) {
        users[idx].passwordHash = hashPassword(String(password));
      }`,
  "password update hashing"
);

fs.writeFileSync(serverPath, server);

let client = fs.readFileSync(clientPath, 'utf8');
client = replaceOnce(
  client,
  /function getAuthHeaders\(\): Record<string, string> \{[\s\S]*?\n\}/,
  `function getAuthHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}`,
  "client auth header removal"
);
client = client.replace(/headers: getAuthHeaders\(\),/g, 'headers: getAuthHeaders(), credentials: "include",');
client = client.replace(/headers: \{ 'Content-Type': 'application\/json' \},\n      cache: 'no-store',/g, 'headers: { "Content-Type": "application/json" },\n      credentials: "include",\n      cache: "no-store",');
client = client.replace(/headers: \{ 'Content-Type': 'application\/json' \},\n      body:/g, 'headers: { "Content-Type": "application/json" },\n      credentials: "include",\n      body:');
fs.writeFileSync(clientPath, client);

let store = fs.readFileSync(storePath, 'utf8');
store = replaceOnce(
  store,
  /passwordHash: 'e6b8c8d0e7e1f2a3', \/\/ Fallback identifier/,
  "passwordHash: 'scrypt$16384$8$1$yqm-9KQptDUZdQDErJ_T5w$_9FUKvhisX3L8zdXLHD8kXVLk6r3QYTfAh31-y4tB53sQp_DjJsYQSC6dlO_J0o69pcSq61KrY-tm7sUHLu09Q',",
  "default admin password hash"
);
fs.writeFileSync(storePath, store);

console.log("Production authentication repair applied.");
