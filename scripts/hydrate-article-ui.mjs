import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appFile = path.join(root, 'src/App.tsx');
const app = fs.readFileSync(appFile, 'utf8');

const helper = [
  'function readArticleBootstrap(): Article[] {',
  "  if (typeof document === 'undefined') return [];",
  "  const node = document.getElementById('solmint-article-bootstrap');",
  '  if (!node?.textContent) return [];',
  '  try {',
  '    const source = JSON.parse(node.textContent) as Record<string, unknown>;',
  '    const article = {',
  "      id: String(source.id || ''), title: String(source.title || ''), slug: String(source.slug || ''),",
  "      category: (String(source.category || 'اخبار و تحلیل')) as Article['category'],",
  "      tags: Array.isArray(source.tags) ? source.tags.map(String) : [],",
  "      summary: String(source.summary || ''), content: String(source.content || ''),",
  "      coverImage: String(source.cover_image || ''), coverImageAssetId: source.cover_image_asset_id ? String(source.cover_image_asset_id) : undefined,",
  "      videoUrl: source.video_url ? String(source.video_url) : undefined,",
  "      author: typeof source.author === 'object' && source.author !== null ? { name: String((source.author as Record<string, unknown>).name || 'تیم تحریریه سولمینت'), role: String((source.author as Record<string, unknown>).role || ''), avatar: String((source.author as Record<string, unknown>).avatar || '') } : { name: String(source.author || 'تیم تحریریه سولمینت'), role: '', avatar: '' },",
  "      publishedAt: String(source.published_at || ''), publishedAtJalali: source.published_at_jalali ? String(source.published_at_jalali) : undefined, publishedAtGregorian: source.published_at_gregorian ? String(source.published_at_gregorian) : undefined,",
  "      readTimeMinutes: Number(source.read_time_minutes || 5), viewsCount: Number(source.views_count || 0),",
  "      comments: Array.isArray(source.comments) ? source.comments : [], seoScore: source.seo_score ? Number(source.seo_score) : undefined, isDraft: Boolean(source.is_draft),",
  '    } as Article;',
  "    return article.id && article.slug && article.title ? [article] : [];",
  '  } catch { return []; }',
  '}',
  '',
].join('\n');

const marker = "const AdminQuickActionsPortal: React.FC";
let updated = app;
if (!updated.includes('function readArticleBootstrap(): Article[]')) {
  const index = updated.indexOf(marker);
  if (index < 0) throw new Error('Unable to locate App.tsx insertion marker');
  updated = updated.slice(0, index) + helper + '\n' + updated.slice(index);
}

const old = "  const [articles, setArticles] = useState<Article[]>(() => safeGetLocalStorage<Article[]>('solmint_articles', INITIAL_ARTICLES));";
const next = [
  '  const [articles, setArticles] = useState<Article[]>(() => {',
  "    const cached = safeGetLocalStorage<Article[]>('solmint_articles', INITIAL_ARTICLES);",
  '    const bootstrap = readArticleBootstrap();',
  '    if (bootstrap.length === 0) return cached;',
  '    const boot = bootstrap[0];',
  '    return [boot, ...cached.filter(article => article.slug !== boot.slug)];',
  '  });',
].join('\n');
if (updated.includes(old)) updated = updated.replace(old, next);

if (updated !== app) fs.writeFileSync(appFile, updated, 'utf8');

const current = fs.readFileSync(appFile, 'utf8');
if (!current.includes('function readArticleBootstrap(): Article[]')) throw new Error('Article bootstrap helper missing after patch');
if (!current.includes('const bootstrap = readArticleBootstrap();')) throw new Error('Article bootstrap state initialization missing after patch');

console.log('✓ Direct article UI bootstrap is present.');
