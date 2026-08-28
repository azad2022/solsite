import fs from 'node:fs';

const filePath = 'src/components/BlogHub.tsx';
const source = fs.readFileSync(filePath, 'utf8');
let next = source;

const htmlImport = "import { buildContextualLinkTargets, linkContextualHtml } from '../utils/contextualHtmlLinking';";
if (!next.includes(htmlImport)) {
  const oldImport = "import { linkContextualHtml } from '../utils/contextualHtmlLinking';";
  if (next.includes(oldImport)) {
    next = next.replace(oldImport, htmlImport);
  } else {
    const taxonomyImport = "import { buildTaxonomyUrl, getArticleCategoryTaxonomy, getArticleTagTaxonomy } from '../utils/articleTaxonomy';";
    if (!next.includes(taxonomyImport)) throw new Error('Internal linking failed: taxonomy import anchor not found.');
    next = next.replace(taxonomyImport, `${taxonomyImport}\n${htmlImport}`);
  }
}

const renderMarker = 'dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(readingArticle.content) }}';
const renderCall = 'linkContextualHtml(renderMarkdownToHtml(readingArticle.content), buildContextualLinkTargets(articles), { currentSlug: readingArticle.slug, maxLinks: 5 })';
const renderReplacement = `dangerouslySetInnerHTML={{ __html: ${renderCall} }}`;

if (next.includes(renderMarker) && !next.includes(renderCall)) next = next.replace(renderMarker, renderReplacement);

if (!next.includes(renderCall)) throw new Error('Internal linking failed: contextual HTML renderer was not patched.');
if (!next.includes('buildContextualLinkTargets(articles)')) throw new Error('Internal linking failed: target catalog was not wired into the article reader.');

if (next !== source) {
  fs.writeFileSync(filePath, next, 'utf8');
  console.log('✓ Contextual internal article linking now uses the unified target catalog.');
} else {
  console.log('✓ Contextual internal article linking already uses the unified target catalog.');
}
