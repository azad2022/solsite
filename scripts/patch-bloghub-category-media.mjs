import fs from 'node:fs';

const file = 'src/components/BlogHub.tsx';
let source = fs.readFileSync(file, 'utf8');
const importAnchor = "import { RelatedArticlesCarousel } from './RelatedArticlesCarousel';";
const importLine = "import { CategoryDefaultMediaDisplay } from './CategoryDefaultMediaDisplay';";
if (!source.includes(importLine)) {
  if (!source.includes(importAnchor)) throw new Error('[bloghub-category-media] import anchor not found');
  source = source.replace(importAnchor, `${importAnchor}\n${importLine}`);
}
const coverPattern = /\{readingArticle\.coverImage && <figure[\s\S]*?<\/figure>\}/;
const replacement = '{<CategoryDefaultMediaDisplay categoryName={readingArticle.category} fallbackUrl={readingArticle.coverImage} fallbackAlt={readingArticle.title} className="border border-slate-800" />}';
if (!source.includes('CategoryDefaultMediaDisplay categoryName={readingArticle.category}')) {
  if (!coverPattern.test(source)) throw new Error('[bloghub-category-media] article cover marker not found');
  source = source.replace(coverPattern, replacement);
}
fs.writeFileSync(file, source, 'utf8');
console.log('✓ [bloghub-category-media] article reader now uses category default media gallery.');
