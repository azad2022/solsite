import fs from 'node:fs';

function update(path, transform) {
  const source = fs.readFileSync(path, 'utf8');
  const next = transform(source);
  if (next === source) return false;
  fs.writeFileSync(path, next);
  console.log(`updated ${path}`);
  return true;
}

let changed = false;

changed ||= update('src/components/SolanaMarketInsights.tsx', (source) => {
  let next = source.replace("import { Activity, BarChart3, Gauge, MessageCircle, RefreshCw, ShieldCheck, TrendingDown, TrendingUp, Waves } from 'lucide-react';", "import { Activity, BarChart3, Gauge, RefreshCw, ShieldCheck, TrendingDown, TrendingUp, Waves } from 'lucide-react';");
  next = next.replace("import { CommentsSection } from './CommentsSection';\n", '');
  const marker = '\nexport const SolanaMarketComments:';
  const index = next.indexOf(marker);
  if (index !== -1) next = next.slice(0, index) + '\n';
  return next;
});

changed ||= update('src/components/AdminCmsModal.tsx', (source) => {
  const needle = 'if (!isAuthenticated) return false;\n';
  if (!source.includes(needle)) throw new Error('AdminCmsModal permission guard not found; refusing to patch.');
  if (source.includes("if (perm === 'comments') return false;")) return source;
  return source.replace(needle, `${needle}    if (perm === 'comments') return false;\n`);
});

changed ||= update('server.ts', (source) => {
  const needle = '  // =========================================================================\n  // --- REAL PERSISTENT DATABASE & API ENDPOINTS (SETTINGS, USERS, COMMENTS, ARTICLES) ---\n  // =========================================================================\n';
  if (!source.includes(needle)) throw new Error('Server API section marker not found; refusing to patch.');
  const guard = '  app.use((req, res, next) => {\n    if (/^\\/api\\/comments(?:\\/|$)/.test(req.path)) {\n      return res.status(404).json({ success: false, message: "بخش نظرات کاربران فعلاً غیرفعال است." });\n    }\n    next();\n  });\n\n';
  if (source.includes('بخش نظرات کاربران فعلاً غیرفعال است')) return source;
  return source.replace(needle, needle + guard);
});

if (!changed) console.log('No source changes required.');
