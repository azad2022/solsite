import fs from 'node:fs';

const file = 'functions/api/article-categories.ts';
let source = fs.readFileSync(file, 'utf8');

const importLine = "import { getAuthenticatedUser } from './auth/_shared';";
if (!source.includes(importLine)) {
  source = `${importLine}\n${source}`;
}

const marker = 'async function adminAuthorized(request: Request, env: Env): Promise<boolean> {';
if (!source.includes(marker)) throw new Error('[category-default-auth] adminAuthorized marker not found');

const sessionCheck = `async function adminAuthorized(request: Request, env: Env): Promise<boolean> {\n  try {\n    const user = await getAuthenticatedUser(env as any, request);\n    if (user && user.is_active !== false) {\n      const permissions = Array.isArray(user.permissions) ? user.permissions.map(String) : [];\n      if (user.role === 'admin' || permissions.includes('articles')) return true;\n    }\n  } catch {\n    // Fall through to the existing passcode authorization path.\n  }`;

if (!source.includes("const user = await getAuthenticatedUser(env as any, request);")) {
  source = source.replace(marker, sessionCheck);
}

fs.writeFileSync(file, source, 'utf8');
console.log('✓ [category-default-auth] category writes now accept the existing authenticated admin session.');
