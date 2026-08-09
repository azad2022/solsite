import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Server-only Supabase credential.
// The service-role key must never be exposed to Vite/client code.
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.VITE_SUPABASE_ANON_KEY;
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY is not configured. Database writes will fail under hardened RLS policies.');
}

function ensureArticlePublishFix(filePath) {
  if (!existsSync(filePath)) return;

  let source = readFileSync(filePath, 'utf8');
  const original = source;

  source = source.replace(
    /is_draft:\s*article\.isDraft\s*\?\s*1\s*:\s*0/g,
    'is_draft: Boolean(article.isDraft)'
  );

  source = source.replace(
    /app\.post\((\"|')\/api\/articles\1,\s*async\s*\(req,\s*res\)/g,
    'app.post($1/api/articles$1, requireAdminAuth, async (req, res)'
  );

  source = source.replace(
    /app\.delete\((\"|')\/api\/articles\/:id\1,\s*async\s*\(req,\s*res\)/g,
    'app.delete($1/api/articles/:id$1, requireAdminAuth, async (req, res)'
  );

  source = source.replace(
    /const SUPABASE_ANON_KEY\s*=\s*process\.env\.VITE_SUPABASE_ANON_KEY\s*\|\|\s*process\.env\.SUPABASE_ANON_KEY\s*\|\|/,
    'const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY ||'
  );

  if (source !== original) {
    writeFileSync(filePath, source, 'utf8');
    console.log(`✅ Applied article publication database fix to ${filePath}`);
  }
}

const sourceServer = resolve(__dirname, '../server.ts');
const builtServer = resolve(__dirname, '../dist/server.cjs');
ensureArticlePublishFix(sourceServer);
ensureArticlePublishFix(builtServer);

// Apply the production comments/replies/votes implementation before the server is loaded.
try {
  await import('./production-comments-patch.mjs');
} catch (error) {
  console.error('❌ Production comments layer failed to load:', error?.message || error);
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

// The market-price page is a virtual public page, not an articles-table row.
// Patch the production comments layer after it is generated and before Express loads.
try {
  await import('./market-comments-production-fix.mjs');
} catch (error) {
  console.error('❌ Solana market comments fix failed to load:', error?.message || error);
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

// Load the production hardening layer before Express registers its routes.
try {
  await import('./production-hardening.mjs');
} catch (error) {
  console.error('❌ Production hardening layer failed to load:', error?.message || error);
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

// Hydrate the server-side JSON persistence layer from Supabase before the app starts,
// and continuously mirror settings/users changes back to Supabase.
try {
  await import('./supabase-persistence-bridge.mjs');
} catch (error) {
  console.error('⚠️ Supabase persistence bridge failed; continuing with local server persistence:', error?.message || error);
}

if (existsSync(builtServer)) {
  await import('../dist/server.cjs');
} else {
  await import('../server.ts');
}
