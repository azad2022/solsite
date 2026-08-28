import fs from 'node:fs';

const filePath = 'src/components/BlogHub.tsx';
const source = fs.readFileSync(filePath, 'utf8');
let next = source;

const entityImport = "import { linkSolanaEntities } from '../utils/solanaEntityLinkerV2';";
if (!next.includes(entityImport)) {
  const oldEntityImport = "import { linkSolanaEntities } from '../utils/solanaEntityLinker';";
  if (next.includes(oldEntityImport)) {
    next = next.replace(oldEntityImport, entityImport);
  } else {
    const taxonomyImport = "import { buildTaxonomyUrl, getArticleCategoryTaxonomy, getArticleTagTaxonomy } from '../utils/articleTaxonomy';";
    if (!next.includes(taxonomyImport)) {
      throw new Error('Internal linking failed: taxonomy import anchor not found.');
    }
    next = next.replace(taxonomyImport, `${taxonomyImport}\n${entityImport}`);
  }
}

const renderMarker = 'dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(readingArticle.content) }}';
const renderReplacement = 'dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(linkSolanaEntities(readingArticle.content, { currentSlug: readingArticle.slug, maxLinks: 5, maxPerEntity: 1, articles: articles.map(article => ({ title: article.title, slug: article.slug })) })) }}';

if (next.includes(renderMarker) && !next.includes('articles: articles.map(article => ({ title: article.title, slug: article.slug }))')) {
  next = next.replace(renderMarker, renderReplacement);
}

if (!next.includes('articles: articles.map(article => ({ title: article.title, slug: article.slug }))')) {
  throw new Error('Internal linking failed: article renderer was not patched with the article catalog.');
}

if (next !== source) {
  fs.writeFileSync(filePath, next, 'utf8');
  console.log('✓ Contextual internal article linking wired into production article rendering.');
} else {
  console.log('✓ Contextual internal article linking already wired; no changes required.');
}
