import fs from 'node:fs';

const blogPath = 'src/components/BlogHub.tsx';
const source = fs.readFileSync(blogPath, 'utf8');
let next = source;

const categorySource = "const categories = ['همه', 'آموزش سولانا', 'توسعه وب۳', 'امنیت', 'اخبار و تحلیل', 'ترید', 'پراپ تریدینگ'];";
const categoryTarget = "const categories = ['همه', 'آموزش سولانا', 'پروژه های سولانا', 'توسعه وب۳', 'امنیت', 'اخبار و تحلیل', 'ترید', 'پراپ تریدینگ'];";
if (next.includes(categorySource)) next = next.replace(categorySource, categoryTarget);

const entityImport = "import { linkSolanaEntities } from '../utils/solanaEntityLinkerV2';";
if (!next.includes(entityImport)) {
  const oldEntityImport = "import { linkSolanaEntities } from '../utils/solanaEntityLinker';";
  if (next.includes(oldEntityImport)) {
    next = next.replace(oldEntityImport, entityImport);
  } else {
    const taxonomyImport = "import { buildTaxonomyUrl, getArticleCategoryTaxonomy, getArticleTagTaxonomy } from '../utils/articleTaxonomy';";
    if (!next.includes(taxonomyImport)) {
      throw new Error('Entity linker wiring failed: taxonomy import anchor not found.');
    }
    next = next.replace(taxonomyImport, `${taxonomyImport}\n${entityImport}`);
  }
}

const entityRender = 'dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(readingArticle.content) }}';
const entityRenderReplacement = 'dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(linkSolanaEntities(readingArticle.content, { currentSlug: readingArticle.slug, maxLinks: 5, maxPerEntity: 1 })) }}';
if (next.includes(entityRender) && !next.includes('linkSolanaEntities(readingArticle.content')) {
  next = next.replace(entityRender, entityRenderReplacement);
}
if (!next.includes('linkSolanaEntities(readingArticle.content')) {
  throw new Error('Entity linker wiring failed: article renderer was not patched.');
}

if (next === source) {
  console.log('No Solana projects SEO wiring changes required.');
  process.exit(0);
}

fs.writeFileSync(blogPath, next, 'utf8');
console.log('✓ Solana projects category and intent-aware entity-linking SEO wiring applied.');
