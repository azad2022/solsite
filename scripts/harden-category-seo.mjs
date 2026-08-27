import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const taxonomySeoFile = path.join(root, 'src/utils/taxonomySeo.ts');
const taxonomyPageFile = path.join(root, 'src/components/ArticleTaxonomyPage.tsx');
const typesFile = path.join(root, 'src/types.ts');

let taxonomySeo = fs.readFileSync(taxonomySeoFile, 'utf8');
taxonomySeo = taxonomySeo.replace("import { buildTaxonomyUrl } from './articleTaxonomy';", "import { buildTaxonomyUrl } from './articleTaxonomy';\nimport { CATEGORY_SEO } from '../config/articleTaxonomy';");
const oldCategoryBlock = /const CATEGORY_SEO:[\\s\\S]*?\n};\n\nexport function updateTaxonomySeo/;
if (oldCategoryBlock.test(taxonomySeo)) taxonomySeo = taxonomySeo.replace(oldCategoryBlock, 'export function updateTaxonomySeo');
taxonomySeo = taxonomySeo.replace("const specialized = type === 'category' ? CATEGORY_SEO[slug] : undefined;", "const specialized = type === 'category' ? CATEGORY_SEO[slug] : undefined;");
taxonomySeo = taxonomySeo.replace("const indexable = type === 'category' && count >= 2;", "const indexable = type === 'category' && Boolean(specialized) && count >= 2;");
taxonomySeo = taxonomySeo.replace("setMeta('robots', indexable ? 'index,follow,max-image-preview:large,max-snippet:-1' : 'noindex,follow');", "setMeta('robots', indexable ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,follow');");
taxonomySeo = taxonomySeo.replace("    description,\n    inLanguage: 'fa-IR',", "    headline: specialized?.h1 || name,\n    description,\n    inLanguage: 'fa-IR',");
taxonomySeo = taxonomySeo.replace("{ '@type': 'ListItem', position: 3, name, item: canonical }", "{ '@type': 'ListItem', position: 3, name: specialized?.h1 || name, item: canonical }");
taxonomySeo = taxonomySeo.replace("mainEntity: { '@type': 'ItemList', numberOfItems: count }", "mainEntity: { '@type': 'ItemList', numberOfItems: count, itemListOrder: 'https://schema.org/ItemListOrderDescending', name: specialized?.h1 || name }");
fs.writeFileSync(taxonomySeoFile, taxonomySeo, 'utf8');

let page = fs.readFileSync(taxonomyPageFile, 'utf8');
if (!page.includes("import { CATEGORY_SEO } from '../config/articleTaxonomy';")) page = page.replace("import { Article } from '../types';", "import { Article } from '../types';\nimport { CATEGORY_SEO } from '../config/articleTaxonomy';");
page = page.replace("const title = taxonomy?.name || 'موضوع مورد نظر';\n  const typeLabel = type === 'category' ? 'دسته‌بندی' : 'برچسب';\n  const intro = type === 'category' ? CATEGORY_INTROS[slug] : undefined;", "const title = taxonomy?.name || 'موضوع مورد نظر';\n  const typeLabel = type === 'category' ? 'دسته‌بندی' : 'برچسب';\n  const specialized = type === 'category' ? CATEGORY_SEO[slug] : undefined;\n  const h1 = specialized?.h1 || title;\n  const intro = specialized?.intro || `مقالات مرتبط با ${typeLabel} «${title}» در آکادمی سولمینت.`;");
page = page.replace('<h1 className="mt-4 text-3xl sm:text-5xl font-black text-white leading-tight">{title}</h1>', '<h1 className="mt-4 text-3xl sm:text-5xl font-black text-white leading-tight">{h1}</h1>');
page = page.replace("{intro || `مقالات مرتبط با ${typeLabel} «${title}» در آکادمی سولمینت.`}", "{intro}");
fs.writeFileSync(taxonomyPageFile, page, 'utf8');

let types = fs.readFileSync(typesFile, 'utf8');
types = types.replace("category: 'آموزش سولانا' | 'توسعه وب۳' | 'امنیت' | 'اخبار و تحلیل' | 'آموزش ساخت میم کوین' | 'آموزش ساخت NFT' | 'کیف پول سولانا' | 'ترید' | 'پراپ تریدینگ';", "category: 'آموزش سولانا' | 'پروژه های سولانا' | 'توسعه وب۳' | 'امنیت' | 'اخبار و تحلیل' | 'آموزش ساخت میم کوین' | 'آموزش ساخت NFT' | 'کیف پول سولانا' | 'ترید' | 'پراپ تریدینگ' | 'میم کوین';");
fs.writeFileSync(typesFile, types, 'utf8');
console.log('✓ Category SEO config, visible H1s, and Article category types hardened.');
