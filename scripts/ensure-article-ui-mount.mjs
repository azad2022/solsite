import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appFile = path.join(root, 'src/App.tsx');
const mainFile = path.join(root, 'src/main.tsx');

let app = fs.readFileSync(appFile, 'utf8');
const helper = [
  'function readArticleBootstrap(): Article[] {',
  "  if (typeof document === 'undefined') return [];",
  "  const node = document.getElementById('solmint-article-bootstrap');",
  '  if (!node?.textContent) return [];',
  '  try {',
  '    const source = JSON.parse(node.textContent) as Record<string, unknown>;',
  '    const rawAuthor = source.author;',
  '    const authorObject = typeof rawAuthor === \'object\' && rawAuthor !== null ? rawAuthor as Record<string, unknown> : null;',
  '    const article = {',
  "      id: String(source.id || ''), title: String(source.title || ''), slug: String(source.slug || ''),",
  "      category: (String(source.category || 'اخبار و تحلیل')) as Article['category'],",
  "      tags: Array.isArray(source.tags) ? source.tags.map(String) : [],",
  "      summary: String(source.summary || ''), content: String(source.content || ''),",
  "      coverImage: String(source.cover_image || ''), coverImageAssetId: source.cover_image_asset_id ? String(source.cover_image_asset_id) : undefined,",
  "      videoUrl: source.video_url ? String(source.video_url) : undefined,",
  "      author: { name: String(authorObject?.name || rawAuthor || 'تیم تحریریه سولمینت'), role: String(authorObject?.role || ''), avatar: String(authorObject?.avatar || '') },",
  "      publishedAt: String(source.published_at || ''), publishedAtJalali: source.published_at_jalali ? String(source.published_at_jalali) : undefined, publishedAtGregorian: source.published_at_gregorian ? String(source.published_at_gregorian) : undefined,",
  "      readTimeMinutes: Number(source.read_time_minutes || 5), viewsCount: Number(source.views_count || 0), comments: Array.isArray(source.comments) ? source.comments : [],",
  "      seoScore: source.seo_score ? Number(source.seo_score) : undefined, isDraft: Boolean(source.is_draft),",
  '    } as Article;',
  "    return article.id && article.slug && article.title ? [article] : [];",
  '  } catch { return []; }',
  '}',
  ''
].join('\n');

if (!app.includes('function readArticleBootstrap(): Article[]')) {
  const marker = 'const AdminQuickActionsPortal: React.FC';
  const index = app.indexOf(marker);
  if (index < 0) throw new Error('App insertion marker not found');
  app = app.slice(0, index) + helper + '\n' + app.slice(index);
}

const oldState = "  const [articles, setArticles] = useState<Article[]>(() => safeGetLocalStorage<Article[]>('solmint_articles', INITIAL_ARTICLES));";
const newState = [
  '  const [articles, setArticles] = useState<Article[]>(() => {',
  "    const cached = safeGetLocalStorage<Article[]>('solmint_articles', INITIAL_ARTICLES);",
  '    const bootstrap = readArticleBootstrap();',
  '    if (bootstrap.length === 0) return cached;',
  '    const boot = bootstrap[0];',
  '    return [boot, ...cached.filter(article => article.slug !== boot.slug)];',
  '  });',
].join('\n');
if (app.includes(oldState)) app = app.replace(oldState, newState);

const hasArticleBootstrapReader = app.includes('function readArticleBootstrap(): Article[]');
const hasArticleBootstrapInitialization = app.includes('const bootstrap = readArticleBootstrap();') || app.includes('const seeds = [...readTaxonomyBootstrap(), ...readArticleBootstrap()];');
if (!hasArticleBootstrapReader || !hasArticleBootstrapInitialization) throw new Error('Article bootstrap patch incomplete');
fs.writeFileSync(appFile, app, 'utf8');

let main = fs.readFileSync(mainFile, 'utf8');
const guard = "const isDirectArticleRoute = typeof window !== 'undefined' && /^\\/article\\/[^/]+\\/?$/.test(window.location.pathname);\n\nif (!isDirectArticleRoute) {\n";
if (main.includes(guard)) {
  main = main.replace(guard, '');
  if (main.endsWith('\n}\n')) main = main.slice(0, -3) + '';
  fs.writeFileSync(mainFile, main, 'utf8');
}
if (!fs.readFileSync(mainFile, 'utf8').includes("createRoot(document.getElementById('root')!).render(")) throw new Error('React mount missing after article UI patch');
console.log('✓ Article SSR is preserved and the real React UI is mounted with article bootstrap data.');
