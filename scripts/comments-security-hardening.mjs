import fs from 'node:fs';

const root = process.cwd();
const filePath = `${root}/server.ts`;

if (!fs.existsSync(filePath)) throw new Error('server.ts not found');
let source = fs.readFileSync(filePath, 'utf8');
const original = source;

// Use a server-only service-role client for comment operations. The key must never be exposed to Vite/client code.
const marker = 'let serverSupabase: SupabaseClient | null = null;';
if (!source.includes('let commentSupabaseAdmin: SupabaseClient | null = null;')) {
  const insert = `${marker}\nlet commentSupabaseAdmin: SupabaseClient | null = null;`;
  source = source.replace(marker, insert);
  const initMarker = 'if (SUPABASE_URL && SUPABASE_ANON_KEY) {';
  const init = `const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';\nif (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {\n  try {\n    commentSupabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });\n  } catch (err) {\n    console.warn('Could not initialize comment service-role client:', err);\n  }\n}\n\n${initMarker}`;
  source = source.replace(initMarker, init);
}

// Never interpolate articleId into a PostgREST .or() expression. Query parameters through eq() only.
source = source.replace(
  /const \{ data: article, error: articleError \} = await serverSupabase\.from\('articles'\)\.select\('id,slug'\)\.or\(`id\.eq\.\$\{articleId\},slug\.eq\.\$\{articleId\}`\)\.maybeSingle\(\);/,
  `const commentDb = commentSupabaseAdmin || serverSupabase;\n        let article: any = null;\n        let articleError: any = null;\n        if (commentDb) {\n          const byId = await commentDb.from('articles').select('id,slug').eq('id', articleId).maybeSingle();\n          if (byId.error) { articleError = byId.error; }\n          article = byId.data || null;\n          if (!article && !articleError) {\n            const bySlug = await commentDb.from('articles').select('id,slug').eq('slug', articleId).maybeSingle();\n            articleError = bySlug.error || null;\n            article = bySlug.data || null;\n          }\n        }`
);

// All comment writes/votes must use the server-only client. Public anon keys must never be used for privileged writes.
const start = source.indexOf('  // 3. PRODUCTION COMMENTS ENDPOINTS');
const end = source.indexOf('  // 4. REAL ARTICLES ENDPOINTS', start);
if (start >= 0 && end > start) {
  let block = source.slice(start, end);
  block = block.replaceAll('if (serverSupabase) {', 'if (commentSupabaseAdmin) {');
  block = block.replaceAll('serverSupabase.from(\'comments\')', 'commentSupabaseAdmin!.from(\'comments\')');
  block = block.replaceAll('serverSupabase.from(\'comment_votes\')', 'commentSupabaseAdmin!.from(\'comment_votes\')');
  block = block.replaceAll('serverSupabase.from(\'articles\')', 'commentSupabaseAdmin!.from(\'articles\')');
  block = block.replaceAll("serverSupabase.rpc('set_comment_vote'", "commentSupabaseAdmin!.rpc('set_comment_vote'");
  source = source.slice(0, start) + block + source.slice(end);
}

// Fail closed in production instead of silently generating a new signing secret on every restart.
source = source.replace(
  /const commentSessionSecret = process\.env\.COMMENT_SESSION_SECRET \|\| crypto\.randomBytes\(32\)\.toString\('hex'\);/,
  `const commentSessionSecret = process.env.COMMENT_SESSION_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('COMMENT_SESSION_SECRET is required in production'); })() : crypto.randomBytes(32).toString('hex'));`
);

// Cookie parsing must not allow malformed percent-encoding to crash an endpoint.
source = source.replace(
  /const parseCookies = \(req: express\.Request\): Record<string, string> => \{[\s\S]*?\n  \};/,
  `const parseCookies = (req: express.Request): Record<string, string> => {\n    const raw = String(req.headers.cookie || '');\n    const out: Record<string, string> = {};\n    for (const part of raw.split(';')) {\n      const trimmed = part.trim();\n      if (!trimmed) continue;\n      const index = trimmed.indexOf('=');\n      if (index < 0) continue;\n      const key = trimmed.slice(0, index);\n      try { out[key] = decodeURIComponent(trimmed.slice(index + 1)); } catch { /* ignore malformed cookie */ }\n    }\n    return out;\n  };`
);

// Explicitly prevent unsafe HTML protocols in user-controlled text if rendered by a future markdown/HTML path.
source = source.replace(
  /const normalizeCommentText = \(value: unknown\) => String\(value \|\| ''\)\.replace\(\\r\\n/g, '\\n'\)\.trim\(\);/,
  `const normalizeCommentText = (value: unknown) => String(value || '').replace(/\\r\\n/g, '\\n').replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]/g, '').trim();`
);

if (source === original) {
  console.log('Comments security hardening: no changes needed.');
} else {
  fs.writeFileSync(filePath, source, 'utf8');
  console.log('Comments security hardening applied.');
}
