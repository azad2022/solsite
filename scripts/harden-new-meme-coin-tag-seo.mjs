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

// 1) Add a first-class tag SEO config next to category SEO.
let config = fs.readFileSync(configFile, 'utf8');
if (!config.includes('export interface TagSeoConfig')) {
  config = config.replace(
    'export interface CategorySeoConfig {',
    "export interface TagSeoConfig {\n  title: string;\n  description: string;\n  h1: string;\n  intro: string;\n  primaryKeyword: string;\n  secondaryKeywords: string[];\n}\n\nexport interface CategorySeoConfig {"
  );
}
if (!config.includes("export const TAG_SEO: Record<string, TagSeoConfig>")) {
  const marker = 'export const CATEGORY_SEO: Record<string, CategorySeoConfig> = {';
  const tagBlock = `export const TAG_SEO: Record<string, TagSeoConfig> = {\n  '${TAG_SLUG}': {\n    title: '${SEO.title}',\n    description: '${SEO.description}',\n    h1: '${SEO.h1}',\n    intro: '${SEO.intro}',\n    primaryKeyword: '${SEO.primaryKeyword}',\n    secondaryKeywords: ${JSON.stringify(SEO.secondaryKeywords)}\n  }\n};\n\n`;
  config = replaceOnce(config, marker, tagBlock + marker, 'TAG_SEO marker');
}
fs.writeFileSync(configFile, config, 'utf8');

// 2) Allow only this strategic tag to be indexable in client SEO.
let taxonomySeo = fs.readFileSync(taxonomySeoFile, 'utf8');
if (!taxonomySeo.includes("import { TAG_SEO }")) {
  taxonomySeo = taxonomySeo.replace(
    "import { CATEGORY_SEO } from '../config/articleTaxonomy';",
    "import { CATEGORY_SEO, TAG_SEO } from '../config/articleTaxonomy';"
  );
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
  "const title = specialized?.title || `${name} | ${type === 'category' ? 'دسته‌بندی' : 'برچسب'} مقالات سولمینت`;",
  "const title = specialized?.title || `${name} | ${type === 'category' ? 'دسته‌بندی' : 'برچسب'} مقالات سولمینت`;"
);
taxonomySeo = taxonomySeo.replace(
  "const description = specialized?.description || `مقالات مرتبط با ${type === 'category' ? 'دسته‌بندی' : 'برچسب'} «${name}» در آکادمی سولمینت؛ آموزش‌ها، تحلیل‌ها و مطالب تخصصی مرتبط با سولانا و وب۳.`;",
  "const description = specialized?.description || `مقالات مرتبط با ${type === 'category' ? 'دسته‌بندی' : 'برچسب'} «${name}» در آکادمی سولمینت؛ آموزش‌ها، تحلیل‌ها و مطالب تخصصی مرتبط با سولانا و وب۳.`;"
);
taxonomySeo = taxonomySeo.replace(
  "setMeta('robots', isIndexableCategory ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, follow');",
  "setMeta('robots', indexable ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, follow');"
);
taxonomySeo = taxonomySeo.replace(
  "if (!isIndexableCategory) {",
  "if (!indexable) {"
);
fs.writeFileSync(taxonomySeoFile, taxonomySeo, 'utf8');

// 3) The HTTP tag route must not blanket-noindex this strategic tag.
let tagFunction = fs.readFileSync(tagFunctionFile, 'utf8');
if (!tagFunction.includes('TAG_SEO')) {
  tagFunction = tagFunction.replace(
    "type PageContext = {",
    "import { TAG_SEO } from '../../../src/config/articleTaxonomy';\n\nconst INDEXABLE_TAG = 'mym-kvyn-jdyd';\n\ntype PageContext = {"
  );
}
tagFunction = tagFunction.replace(
  "headers.set('X-Robots-Tag', 'noindex, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');",
  "const slug = String(context.params?.slug || '').trim().toLowerCase();\n  const indexable = slug === INDEXABLE_TAG && Boolean(TAG_SEO[slug]);\n  headers.set('X-Robots-Tag', indexable ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');"
);
tagFunction = tagFunction.replace("headers.set('X-Solmint-SEO', 'tag-archive-noindex-v1');", "headers.set('X-Solmint-SEO', indexable ? 'tag-archive-indexable-v1' : 'tag-archive-noindex-v1');");
fs.writeFileSync(tagFunctionFile, tagFunction, 'utf8');

// 4) Make taxonomy sitemap include the strategic tag alongside categories.
let sitemap = fs.readFileSync(taxonomySitemapFile, 'utf8');
if (!sitemap.includes('TAG_SLUG')) {
  sitemap = sitemap.replace(
    "import { CATEGORY_SLUGS } from '../src/config/articleTaxonomy';",
    "import { CATEGORY_SLUGS, TAG_SEO } from '../src/config/articleTaxonomy';"
  );
  sitemap = sitemap.replace(
    "const INDEXABLE_CATEGORY_MIN_ARTICLES = 2;",
    "const INDEXABLE_CATEGORY_MIN_ARTICLES = 2;\nconst INDEXABLE_TAG_MIN_ARTICLES = 2;\nconst INDEXABLE_TAG_SLUGS = new Set(Object.keys(TAG_SEO));"
  );
  const marker = "    for (const item of categories.values()) {\n      if (item.count < INDEXABLE_CATEGORY_MIN_ARTICLES) continue;\n      const url = `${BASE_URL}/blog/category/${encodeURIComponent(item.slug)}`;\n      xml += `  <url>\\n    <loc>${xmlEscape(url)}</loc>\\n`;\n      if (item.lastmod) xml += `    <lastmod>${xmlEscape(item.lastmod)}</lastmod>\\n`;\n      xml += '  </url>\\n';\n    }";
  const replacement = marker + `\n\n    // Indexable editorial tags are opt-in; currently only the strategic new-meme-coin tag is eligible.\n    const tagCounts = new Map<string, number>();\n    const tagLastmods = new Map<string, string | null>();\n    const targetTag = 'میم کوین جدید';\n    for (const article of articles) {\n      const tags = Array.isArray((article as any).tags) ? (article as any).tags : [];\n      if (!tags.some((tag: unknown) => String(tag).trim() === targetTag)) continue;\n      const slug = 'mym-kvyn-jdyd';\n      if (!INDEXABLE_TAG_SLUGS.has(slug)) continue;\n      tagCounts.set(slug, (tagCounts.get(slug) || 0) + 1);\n      const next = lastModified(article);\n      tagLastmods.set(slug, newer(tagLastmods.get(slug) || null, next));\n    }\n    for (const [slug, count] of tagCounts) {\n      if (count < INDEXABLE_TAG_MIN_ARTICLES) continue;\n      const url = `${BASE_URL}/blog/tag/${encodeURIComponent(slug)}`;\n      xml += `  <url>\\n    <loc>${xmlEscape(url)}</loc>\\n`;\n      const lastmod = tagLastmods.get(slug);\n      if (lastmod) xml += `    <lastmod>${xmlEscape(lastmod)}</lastmod>\\n`;\n      xml += '  </url>\\n';\n    }`;
  if (sitemap.includes(marker)) sitemap = sitemap.replace(marker, replacement);
}
fs.writeFileSync(taxonomySitemapFile, sitemap, 'utf8');

// 5) Keep the route in Functions routing.
const routes = JSON.parse(fs.readFileSync(routesFile, 'utf8'));
if (!routes.include.includes('/blog/*')) routes.include.push('/blog/*');
fs.writeFileSync(routesFile, JSON.stringify(routes, null, 2) + '\n', 'utf8');

console.log('✓ Strategic SEO hardening applied to tag: میم کوین جدید');
console.log(`  slug: ${TAG_SLUG}`);
console.log(`  primary keyword: ${SEO.primaryKeyword}`);
console.log(`  secondary keywords: ${SEO.secondaryKeywords.join(', ')}`);
