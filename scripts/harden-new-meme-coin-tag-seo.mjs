import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const configFile = path.join(root, 'src/config/articleTaxonomy.ts');
const taxonomySeoFile = path.join(root, 'src/utils/taxonomySeo.ts');
const tagFunctionFile = path.join(root, 'functions/blog/tag/[slug].ts');
const taxonomySitemapFile = path.join(root, 'functions/sitemap-taxonomy.xml.ts');
const routesFile = path.join(root, 'public/_routes.json');

const TAG_SLUG = 'mym-kvyn-jdyd';
const TAG_NAME = 'میم کوین جدید';
const SEO = {
  title: 'میم کوین جدید | جدیدترین میم کوین‌های سولانا و بازار کریپتو | سولمینت',
  description: 'جدیدترین میم کوین‌های سولانا و بازار کریپتو را در سولمینت دنبال کنید؛ پوشش پروژه‌های تازه، میم‌کوین‌های ترند، داده‌های بازار، ریسک‌ها و بررسی‌های به‌روز.',
  h1: 'میم کوین جدید؛ جدیدترین میم‌کوین‌های سولانا و بازار کریپتو',
  intro: 'این صفحه مرجع پوشش «میم کوین جدید» در سولمینت است؛ مقاله‌های مرتبط با میم‌کوین‌های تازه‌وارد، پروژه‌های تازه‌فعال‌شده و موج‌های جدید بازار را یکجا دنبال کنید. تمرکز مطالب بر اطلاعات قابل بررسی، وضعیت بازار، نقدینگی، حجم، سابقه پروژه و ریسک‌های مهم است و محتوای این صفحه توصیه خرید یا فروش نیست.',
  primaryKeyword: 'میم کوین جدید',
  secondaryKeywords: [
    'میم کوین های جدید',
    'میم کوین جدید سولانا',
    'میم کوین های جدید سولانا',
    'جدیدترین میم کوین های سولانا',
    'میم کوین های ترند',
    'میم کوین های جدید 2026'
  ]
};

function replaceOnce(source, oldValue, newValue, label) {
  if (!source.includes(oldValue)) throw new Error(`Missing ${label}`);
  return source.replace(oldValue, newValue);
}

let config = fs.readFileSync(configFile, 'utf8');
if (!config.includes('export interface TagSeoConfig')) {
  config = config.replace(
    'export interface CategorySeoConfig {',
    "export interface TagSeoConfig {\n  title: string;\n  description: string;\n  h1: string;\n  intro: string;\n  primaryKeyword: string;\n  secondaryKeywords: string[];\n}\n\nexport interface CategorySeoConfig {"
  );
}
if (!config.includes("export const TAG_SEO: Record<string, TagSeoConfig>")) {
  const marker = 'export const CATEGORY_SEO: Record<string, CategorySeoConfig> = {';
  const tagBlock = [
    'export const TAG_SEO: Record<string, TagSeoConfig> = {',
    `  '${TAG_SLUG}': {`,
    `    title: '${SEO.title}',`,
    `    description: '${SEO.description}',`,
    `    h1: '${SEO.h1}',`,
    `    intro: '${SEO.intro}',`,
    `    primaryKeyword: '${SEO.primaryKeyword}',`,
    `    secondaryKeywords: ${JSON.stringify(SEO.secondaryKeywords)}`,
    '  }',
    '};',
    ''
  ].join('\n');
  config = replaceOnce(config, marker, tagBlock + marker, 'TAG_SEO marker');
}
fs.writeFileSync(configFile, config, 'utf8');

let taxonomySeo = fs.readFileSync(taxonomySeoFile, 'utf8');
// Normalize TAG_SEO imports so repeated production builds cannot create duplicate bindings.
taxonomySeo = taxonomySeo
  .replace(/\n?import \{\s*CATEGORY_SEO\s*,\s*TAG_SEO\s*\} from ['"]\.\.\/config\/articleTaxonomy['"];\n?/g, '\n')
  .replace(/\n?import \{\s*TAG_SEO\s*\} from ['"]\.\.\/config\/tagSeo['"];\n?/g, '\n');
const categoryImport = "import { CATEGORY_SEO } from '../config/articleTaxonomy';";
taxonomySeo = taxonomySeo.replace(categoryImport, categoryImport + "\nimport { TAG_SEO } from '../config/tagSeo';");
if (!taxonomySeo.includes("import { TAG_SEO } from '../config/tagSeo';")) {
  taxonomySeo = "import { CATEGORY_SEO } from '../config/articleTaxonomy';\nimport { TAG_SEO } from '../config/tagSeo';\n\n" + taxonomySeo;
}

taxonomySeo = taxonomySeo.replace(
  "const specialized = type === 'category' ? CATEGORY_SEO[slug] : undefined;",
  "const specialized = type === 'category' ? CATEGORY_SEO[slug] : TAG_SEO[slug];"
);
taxonomySeo = taxonomySeo.replace(
  "const isIndexableCategory = type === 'category' && Boolean(specialized) && count >= 2;",
  "const isIndexableCategory = type === 'category' && Boolean(CATEGORY_SEO[slug]) && count >= 2;\n  const isIndexableTag = type === 'tag' && Boolean(TAG_SEO[slug]) && count >= 2;\n  const indexable = isIndexableCategory || isIndexableTag;"
);
taxonomySeo = taxonomySeo.replace(
  "setMeta('robots', isIndexableCategory ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, follow');",
  "setMeta('robots', indexable ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, follow');"
);
taxonomySeo = taxonomySeo.replace("if (!isIndexableCategory) {", "if (!indexable) {");
fs.writeFileSync(taxonomySeoFile, taxonomySeo, 'utf8');

let tagFunction = fs.readFileSync(tagFunctionFile, 'utf8');
if (!tagFunction.includes("import { TAG_SEO }")) {
  tagFunction = tagFunction.replace(
    "import { getCanonicalTagSlug } from '../../../src/config/articleTaxonomy';",
    "import { getCanonicalTagSlug } from '../../../src/config/articleTaxonomy';\nimport { TAG_SEO } from '../../../src/config/tagSeo';\n\nconst INDEXABLE_TAG = 'mym-kvyn-jdyd';"
  );
}
tagFunction = tagFunction.replace(
  "headers.set('X-Robots-Tag', 'noindex, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');",
  "const indexable = slug === INDEXABLE_TAG && Boolean(TAG_SEO[slug]);\n    headers.set('X-Robots-Tag', indexable ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');"
);
tagFunction = tagFunction.replace("headers.set('X-Solmint-SEO', 'tag-archive-noindex-v1');", "headers.set('X-Solmint-SEO', indexable ? 'tag-archive-indexable-v1' : 'tag-archive-noindex-v1');");
fs.writeFileSync(tagFunctionFile, tagFunction, 'utf8');

let sitemap = fs.readFileSync(taxonomySitemapFile, 'utf8');
if (!sitemap.includes('TAG_SLUG')) {
  sitemap = sitemap.replace(
    "import { CATEGORY_SLUGS } from '../src/config/articleTaxonomy';",
    "import { CATEGORY_SLUGS } from '../src/config/articleTaxonomy';\nimport { TAG_SEO } from '../src/config/tagSeo';"
  );
  sitemap = sitemap.replace(
    "const INDEXABLE_CATEGORY_MIN_ARTICLES = 2;",
    "const INDEXABLE_CATEGORY_MIN_ARTICLES = 2;\nconst INDEXABLE_TAG_MIN_ARTICLES = 2;\nconst INDEXABLE_TAG_SLUGS = new Set(Object.keys(TAG_SEO));"
  );
  const marker = [
    "    for (const item of categories.values()) {",
    "      if (item.count < INDEXABLE_CATEGORY_MIN_ARTICLES) continue;",
    "      const url = `${BASE_URL}/blog/category/${encodeURIComponent(item.slug)}`;",
    "      xml += `  <url>\\n    <loc>${xmlEscape(url)}</loc>\\n`;",
    "      if (item.lastmod) xml += `    <lastmod>${xmlEscape(item.lastmod)}</lastmod>\\n`;",
    "      xml += '  </url>\\n';",
    '    }'
  ].join('\n');
  const replacement = [
    marker,
    '',
    "    // Indexable editorial tags are opt-in; currently only the strategic new-meme-coin tag is eligible.",
    '    const tagCounts = new Map<string, number>();',
    '    const tagLastmods = new Map<string, string | null>();',
    `    const targetTag = '${TAG_NAME}';`,
    '    for (const article of articles) {',
    "      const tags = Array.isArray((article as any).tags) ? (article as any).tags : [];",
    '      if (!tags.some((tag: unknown) => String(tag).trim() === targetTag)) continue;',
    `      const slug = '${TAG_SLUG}';`,
    '      if (!INDEXABLE_TAG_SLUGS.has(slug)) continue;',
    '      tagCounts.set(slug, (tagCounts.get(slug) || 0) + 1);',
    '      const next = lastModified(article);',
    '      tagLastmods.set(slug, newer(tagLastmods.get(slug) || null, next));',
    '    }',
    '    for (const [slug, count] of tagCounts) {',
    '      if (count < INDEXABLE_TAG_MIN_ARTICLES) continue;',
    '      const url = `${BASE_URL}/blog/tag/${encodeURIComponent(slug)}`;',
    "      xml += `  <url>\\n    <loc>${xmlEscape(url)}</loc>\\n`;",
    '      const lastmod = tagLastmods.get(slug);',
    '      if (lastmod) xml += `    <lastmod>${xmlEscape(lastmod)}</lastmod>\\n`;',
    "      xml += '  </url>\\n';",
    '    }'
  ].join('\n');
  if (sitemap.includes(marker)) sitemap = sitemap.replace(marker, replacement);
}
fs.writeFileSync(taxonomySitemapFile, sitemap, 'utf8');

// Preserve Cloudflare Functions routing invariants for both taxonomy and article SSR.
const routes = JSON.parse(fs.readFileSync(routesFile, 'utf8'));
if (!routes.include.includes('/blog/*')) routes.include.push('/blog/*');
if (!routes.include.includes('/article/*')) routes.include.push('/article/*');
fs.writeFileSync(routesFile, JSON.stringify(routes, null, 2) + '\n', 'utf8');

console.log('✓ Strategic SEO hardening applied to tag: میم کوین جدید');
console.log(`  slug: ${TAG_SLUG}`);
console.log(`  primary keyword: ${SEO.primaryKeyword}`);
console.log(`  secondary keywords: ${SEO.secondaryKeywords.join(', ')}`);
