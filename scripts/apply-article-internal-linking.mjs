import fs from 'node:fs';

const filePath = 'src/components/BlogHub.tsx';
const source = fs.readFileSync(filePath, 'utf8');
let next = source;

const htmlImport = "import { linkContextualHtml } from '../utils/contextualHtmlLinking';";
if (!next.includes(htmlImport)) {
  const taxonomyImport = "import { buildTaxonomyUrl, getArticleCategoryTaxonomy, getArticleTagTaxonomy } from '../utils/articleTaxonomy';";
  if (!next.includes(taxonomyImport)) throw new Error('Internal linking failed: taxonomy import anchor not found.');
  next = next.replace(taxonomyImport, `${taxonomyImport}\n${htmlImport}`);
}

const renderMarker = 'dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(readingArticle.content) }}';
const renderReplacement = "dangerouslySetInnerHTML={{ __html: linkContextualHtml(renderMarkdownToHtml(readingArticle.content), articles.map(article => ({ title: article.title, slug: article.slug })), { currentSlug: readingArticle.slug, maxLinks: 5 }) }}";

if (next.includes(renderMarker) && !next.includes('linkContextualHtml(renderMarkdownToHtml(readingArticle.content)')) {
  next = next.replace(renderMarker, renderReplacement);
}

if (!next.includes('linkContextualHtml(renderMarkdownToHtml(readingArticle.content)')) {
  throw new Error('Internal linking failed: HTML-aware article renderer was not patched.');
}

if (next !== source) {
  fs.writeFileSync(filePath, next, 'utf8');
  console.log('✓ HTML-aware contextual internal article linking wired into production reader.');
} else {
  console.log('✓ HTML-aware contextual internal article linking already wired; no changes required.');
}
