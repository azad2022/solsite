import fs from 'node:fs';

const blogPath = 'src/components/BlogHub.tsx';
const source = fs.readFileSync(blogPath, 'utf8');
let next = source;

const categorySource = "const categories = ['همه', 'آموزش سولانا', 'توسعه وب۳', 'امنیت', 'اخبار و تحلیل', 'ترید', 'پراپ تریدینگ'];";
const categoryTarget = "const categories = ['همه', 'آموزش سولانا', 'پروژه های سولانا', 'توسعه وب۳', 'امنیت', 'اخبار و تحلیل', 'ترید', 'پراپ تریدینگ'];";
if (next.includes(categorySource)) next = next.replace(categorySource, categoryTarget);

const anchor = "  const featuredArticle = filteredArticles[0] || articles[0];\n  const gridArticles = filteredArticles.length > 1 ? filteredArticles.slice(1) : filteredArticles;";
const relatedModel = "  const featuredArticle = filteredArticles[0] || articles[0];\n  const gridArticles = filteredArticles.length > 1 ? filteredArticles.slice(1) : filteredArticles;\n  const relatedArticles = readingArticle ? articles\n    .filter(article => article.id !== readingArticle.id)\n    .map(article => {\n      const sharedTags = article.tags.filter(tag => readingArticle.tags.includes(tag)).length;\n      const sameCategory = article.category === readingArticle.category ? 4 : 0;\n      return { article, score: sameCategory + sharedTags };\n    })\n    .filter(item => item.score > 0)\n    .sort((a, b) => b.score - a.score || String(b.article.publishedAt || '').localeCompare(String(a.article.publishedAt || '')))\n    .slice(0, 4)\n    .map(item => item.article) : [];";
if (next.includes(anchor) && !next.includes('const relatedArticles = readingArticle ? articles')) {
  next = next.replace(anchor, relatedModel);
}

const contentNeedle = 'dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(readingArticle.content) }}';
if (!next.includes('related-solana-projects-heading')) {
  const contentIndex = next.indexOf(contentNeedle);
  if (contentIndex < 0) throw new Error('Solana projects SEO wiring failed: article content renderer marker was not found.');
  const lineStart = next.lastIndexOf('<div', contentIndex);
  const lineEnd = next.indexOf('/>', contentIndex) + 2;
  if (lineStart < 0 || lineEnd <= lineStart) throw new Error('Solana projects SEO wiring failed: unable to locate article content container.');
  const existingContent = next.slice(lineStart, lineEnd);
  const block = `${existingContent}\n              {relatedArticles.length > 0 && <section aria-labelledby="related-solana-projects-heading" className="mt-10 rounded-2xl border border-slate-800 bg-slate-950/50 p-5 sm:p-6">\n                <div className="flex items-center justify-between gap-4 mb-4">\n                  <h3 id="related-solana-projects-heading" className="text-lg font-extrabold text-white">مطالب مرتبط برای ادامه مطالعه</h3>\n                  <a href="/blog/category/solana-projects" onClick={event => { event.preventDefault(); onNavigate?.('/blog/category/solana-projects'); }} className="text-xs font-bold text-sky-400 hover:text-sky-300">همه پروژه های سولانا</a>\n                </div>\n                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">\n                  {relatedArticles.map(article => <a key={article.id} href={\`/article/${article.slug}\`} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); handleOpenArticle(article); } }} className="block rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-sky-500/40 transition-colors">\n                    <span className="text-[11px] text-sky-400 font-bold">{article.category}</span>\n                    <span className="mt-1 block text-sm font-bold text-white leading-6">{article.title}</span>\n                  </a>)}\n                </div>\n              </section>`;
  next = next.slice(0, lineStart) + block + next.slice(lineEnd);
}

const entityImport = "import { linkSolanaEntities } from '../utils/solanaEntityLinkerV2';";
if (!next.includes(entityImport)) {
  const oldEntityImport = "import { linkSolanaEntities } from '../utils/solanaEntityLinker';";
  if (next.includes(oldEntityImport)) next = next.replace(oldEntityImport, entityImport);
  else {
    const taxonomyImport = "import { buildTaxonomyUrl, getArticleCategoryTaxonomy, getArticleTagTaxonomy } from '../utils/articleTaxonomy';";
    if (!next.includes(taxonomyImport)) throw new Error('Entity linker wiring failed: taxonomy import anchor not found.');
    next = next.replace(taxonomyImport, `${taxonomyImport}\n${entityImport}`);
  }
}

const entityRender = 'dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(readingArticle.content) }}';
const entityRenderReplacement = 'dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(linkSolanaEntities(readingArticle.content, { currentSlug: readingArticle.slug, maxLinks: 5, maxPerEntity: 1 })) }}';
if (next.includes(entityRender) && !next.includes('linkSolanaEntities(readingArticle.content')) next = next.replace(entityRender, entityRenderReplacement);
if (!next.includes('linkSolanaEntities(readingArticle.content')) throw new Error('Entity linker wiring failed: article renderer was not patched.');

if (next === source) {
  console.log('No BlogHub changes required.');
  process.exit(0);
}
fs.writeFileSync(blogPath, next, 'utf8');
console.log('✓ Solana projects category, related-content and intent-aware entity-linking SEO wiring applied.');
