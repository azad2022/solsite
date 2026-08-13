import fs from 'node:fs';

const filePath = 'src/components/BlogHub.tsx';
const source = fs.readFileSync(filePath, 'utf8');
let next = source;

const importLine = "import { linkSolanaEntities } from '../utils/solanaEntityLinker';";
if (!next.includes(importLine)) {
  const anchor = "import { buildTaxonomyUrl, getArticleCategoryTaxonomy, getArticleTagTaxonomy } from '../utils/articleTaxonomy';";
  if (!next.includes(anchor)) throw new Error('Entity linker patch: taxonomy import anchor not found.');
  next = next.replace(anchor, `${anchor}\n${importLine}`);
}

const oldRender = 'dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(readingArticle.content) }}';
const newRender = 'dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(linkSolanaEntities(readingArticle.content, { currentSlug: readingArticle.slug, maxLinks: 5, maxPerEntity: 1 })) }}';

if (next.includes(oldRender) && !next.includes('linkSolanaEntities(readingArticle.content')) {
  next = next.replace(oldRender, newRender);
}

if (!next.includes('linkSolanaEntities(readingArticle.content')) {
  throw new Error('Entity linker patch: article render call was not wired.');
}

if (next !== source) fs.writeFileSync(filePath, next, 'utf8');
console.log('✓ Solana entity linker wired into article rendering.');
