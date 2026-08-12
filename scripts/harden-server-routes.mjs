import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'server.ts');
let source = readFileSync(file, 'utf8');
const original = source;

// The legacy Express server may still be used by the Node deployment path.
// Keep all privileged mutations behind the same server-side session middleware.
const protectedRoutes = [
  ['get', '/api/users'],
  ['post', '/api/users/register'],
  ['post', '/api/comments/approve'],
  ['post', '/api/comments/delete'],
  ['post', '/api/articles'],
  ['delete', '/api/articles/:id']
];

for (const [method, path] of protectedRoutes) {
  const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const routeRegex = new RegExp(`app\\.${method}\\(\\s*[\\\"]${escapedPath}[\\\"]\\s*,\\s*([^\\n]*)`, 'm');
  const match = source.match(routeRegex);
  if (!match) {
    throw new Error(`Server authentication hardening failed: route declaration not found for ${method.toUpperCase()} ${path}`);
  }
  const args = match[1];
  if (!args.includes('requireAdminAuth')) {
    const routePrefix = match[0].replace(new RegExp(`${escapedPath}[\\\"]\\s*,\\s*`), `${path}", requireAdminAuth, `);
    source = source.replace(match[0], routePrefix);
  }
}

// Never trust a client-supplied password hash and never create privileged users from
// an unauthenticated request. Passwords created by this legacy Express path use the
// same PBKDF2 format accepted by the Cloudflare auth verifier.
const helper = `\nfunction hashPasswordForStorage(password: string): string {\n  const salt = crypto.randomBytes(16);\n  const iterations = 310000;\n  const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");\n  return \`pbkdf2-sha256$\${iterations}$\${salt.toString("hex")}$\${derived.toString("hex")}\`;\n}\n`;
if (!source.includes('function hashPasswordForStorage(')) {
  source = source.replace(/function hashString\([\s\S]*?\n}\n/, match => match + helper);
}
source = source.replace(/const passInput = String\(passwordHash \|\| req\.body\?\.password \|\| \"\"\)\.trim\(\);\n\s*const finalHash = passInput\.length === 64 \? passInput : hashString\(passInput\);/, 'const passInput = String(req.body?.password || "").trim();\n      const finalHash = hashPasswordForStorage(passInput);');
source = source.replace(/const \{ username, fullName, passwordHash, role, permissions, isActive \} = req\.body \|\| \{\};/, 'const { username, fullName, password, permissions, isActive } = req.body || {};\n      const role = "user";');

// User-management updates must not accept a client-generated password hash either.
source = source.replace(/const \{ userId, role, permissions, isActive, password, passwordHash \} = req\.body \|\| \{\};/, 'const { userId, role, permissions, isActive, password } = req.body || {};');
source = source.replace(/if \(passwordHash\) \{\n\s*users\[idx\]\.passwordHash = String\(passwordHash\);\n\s*\} else if \(password\) \{\n\s*users\[idx\]\.passwordHash = hashString\(String\(password\)\);\n\s*\}/, 'if (password) {\n        users[idx].passwordHash = hashPasswordForStorage(String(password));\n      }');

// Fail closed if any high-risk legacy route exists without the authentication middleware.
for (const [method, path] of protectedRoutes) {
  const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const routeRegex = new RegExp(`app\\.${method}\\(\\s*[\\\"]${escapedPath}[\\\"]\\s*,\\s*([^\\n]*)`, 'm');
  const match = source.match(routeRegex);
  if (!match || !match[1].includes('requireAdminAuth')) {
    throw new Error(`Server authentication hardening failed: ${method.toUpperCase()} ${path} is not protected by requireAdminAuth`);
  }
}

if (source.includes('passwordHash } = req.body') || source.includes('passwordHash || req.body?.password')) {
  throw new Error('Server authentication hardening failed: client-supplied password hash remains');
}

if (source !== original) writeFileSync(file, source, 'utf8');
console.log('✓ Server admin routes and password handling hardened.');
