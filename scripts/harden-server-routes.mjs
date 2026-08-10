import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'server.ts');
let source = readFileSync(file, 'utf8');
const original = source;

// The Express server can still be used by the Node deployment path. Keep its admin
// mutations behind the same server-side session used by the production auth layer.
const protectedRoutes = [
  ["app.get(\"/api/users\", (req, res) =>", "app.get(\"/api/users\", requireAdminAuth, (req, res) =>"],
  ["app.post(\"/api/users/register\", (req, res) =>", "app.post(\"/api/users/register\", requireAdminAuth, (req, res) =>"],
  ["app.post(\"/api/comments/approve\", (req, res) =>", "app.post(\"/api/comments/approve\", requireAdminAuth, (req, res) =>"],
  ["app.post(\"/api/comments/delete\", async (req, res) =>", "app.post(\"/api/comments/delete\", requireAdminAuth, async (req, res) =>"],
  ["app.post(\"/api/articles\", async (req, res) =>", "app.post(\"/api/articles\", requireAdminAuth, async (req, res) =>"],
  ["app.delete(\"/api/articles/:id\", async (req, res) =>", "app.delete(\"/api/articles/:id\", requireAdminAuth, async (req, res) =>"]
];

for (const [from, to] of protectedRoutes) {
  source = source.split(from).join(to);
}

// Never trust a client-supplied password hash and never create privileged users from
// an unauthenticated request. Passwords created by this legacy Express path use the
// same PBKDF2 format accepted by the Cloudflare auth verifier.
const helper = `\nfunction hashPasswordForStorage(password: string): string {\n  const salt = crypto.randomBytes(16);\n  const iterations = 310000;\n  const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, \"sha256\");\n  return \`pbkdf2-sha256$\${iterations}$\${salt.toString(\"hex\")}$\${derived.toString(\"hex\")}\`;\n}\n`;
if (!source.includes('function hashPasswordForStorage(')) {
  source = source.replace(/function hashString\([\s\S]*?\n}\n/, match => match + helper);
}
source = source.replace(/const passInput = String\(passwordHash \|\| req\.body\?\.password \|\| \"\"\)\.trim\(\);\n\s*const finalHash = passInput\.length === 64 \? passInput : hashString\(passInput\);/, 'const passInput = String(req.body?.password || \"\").trim();\n      const finalHash = hashPasswordForStorage(passInput);');
source = source.replace(/const \{ username, fullName, passwordHash, role, permissions, isActive \} = req\.body \|\| \{\};/, 'const { username, fullName, password, permissions, isActive } = req.body || {};\n      const role = \"user\";');

// User-management updates must not accept a client-generated password hash either.
source = source.replace(/const \{ userId, role, permissions, isActive, password, passwordHash \} = req\.body \|\| \{\};/, 'const { userId, role, permissions, isActive, password } = req.body || {};');
source = source.replace(/if \(passwordHash\) \{\n\s*users\[idx\]\.passwordHash = String\(passwordHash\);\n\s*\} else if \(password\) \{\n\s*users\[idx\]\.passwordHash = hashString\(String\(password\)\);\n\s*\}/, 'if (password) {\n        users[idx].passwordHash = hashPasswordForStorage(String(password));\n      }');

// Fail closed if any of the high-risk legacy routes remain unprotected.
const required = [
  'app.get("/api/users", requireAdminAuth',
  'app.post("/api/users/register", requireAdminAuth',
  'app.post("/api/comments/approve", requireAdminAuth',
  'app.post("/api/comments/delete", requireAdminAuth',
  'app.post("/api/articles", requireAdminAuth',
  'app.delete("/api/articles/:id", requireAdminAuth'
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Server authentication hardening failed: ${marker}`);
}
if (source.includes('passwordHash } = req.body') || source.includes('passwordHash || req.body?.password')) {
  throw new Error('Server authentication hardening failed: client-supplied password hash remains');
}

if (source !== original) writeFileSync(file, source, 'utf8');
console.log('✓ Server admin routes and password handling hardened.');
