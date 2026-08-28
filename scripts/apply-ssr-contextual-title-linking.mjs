import fs from 'node:fs';

const file = 'functions/article/[slug].ts';
const source = fs.readFileSync(file, 'utf8');
let next = source;

const importLine = "import { fetchContextualArticleTargets, linkContextualArticleTitles, renderContextualMarkdownLine } from '../../src/utils/contextualArticleLinking';";
if (!next.includes(importLine)) {
  const anchor = "import { detectArticleLocale } from '../seo-helpers';";
  if (!next.includes(anchor)) throw new Error('SSR contextual linker import anchor not found');
  next = next.replace(anchor, `${anchor}\n${importLine}`);
}

const renderBodyMarker = 'function renderBody(value: string) {';
if (next.includes(renderBodyMarker) && !next.includes('renderContextualMarkdownLine(line, escapeHtml, safeUrl)')) {
  const start = next.indexOf(renderBodyMarker);
  const end = next.indexOf('\nfunction setMeta(', start);
  if (start < 0 || end < 0) throw new Error('SSR renderBody boundaries not found');
  const block = next.slice(start, end);
  const oldParagraph = "out.push('<p>' + escapeHtml(line) + '</p>');";
  if (!block.includes(oldParagraph)) throw new Error('SSR plain paragraph marker not found');
  const replacement = block.replace(oldParagraph, "out.push('<p>' + renderContextualMarkdownLine(line, escapeHtml, safeUrl) + '</p>');");
  next = next.slice(0, start) + replacement + next.slice(end);
}

const oldInject = 'function inject(html: string, article: ArticleRecord, related: RelatedArticle[]) {';
if (next.includes(oldInject)) {
  next = next.replace(oldInject, 'function inject(html: string, article: ArticleRecord, related: RelatedArticle[], contextualContent: string) {');
}
if (next.includes("${renderBody(article.content || '')}")) {
  next = next.replace("${renderBody(article.content || '')}", "${renderBody(contextualContent)}");
}

const oldRelated = 'const related = await fetchRelated(base, key, article);';
if (next.includes(oldRelated) && !next.includes('const [related, internalTitleTargets] = await Promise.all([')) {
  const replacement = `const [related, internalTitleTargets] = await Promise.all([\n      fetchRelated(base, key, article),\n      fetchContextualArticleTargets(base, key)\n    ]);\n    const contextualContent = linkContextualArticleTitles(article.content || '', internalTitleTargets, article.slug, 5);`;
  next = next.replace(oldRelated, replacement);
}

const oldReturn = 'return new Response(inject(html, article, related), { status: 200, headers });';
if (next.includes(oldReturn)) {
  next = next.replace(oldReturn, 'return new Response(inject(html, article, related, contextualContent), { status: 200, headers });');
}

const required = [
  importLine,
  'renderContextualMarkdownLine(line, escapeHtml, safeUrl)',
  'contextualContent: string',
  'fetchContextualArticleTargets(base, key)',
  'return new Response(inject(html, article, related, contextualContent), { status: 200, headers });'
];
for (const marker of required) {
  if (!next.includes(marker)) throw new Error(`SSR contextual title linking failed: missing ${marker}`);
}

if (next !== source) {
  fs.writeFileSync(file, next, 'utf8');
  console.log('✓ SSR contextual article title linking applied.');
} else {
  console.log('✓ SSR contextual article title linking already applied.');
}
