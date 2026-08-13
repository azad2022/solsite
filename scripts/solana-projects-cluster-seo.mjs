import fs from 'node:fs';

const blogPath = 'src/components/BlogHub.tsx';
const source = fs.readFileSync(blogPath, 'utf8');
let next = source;

// Keep the category hub visible in the primary blog navigation.
next = next.replace(
  "const categories = ['همه', 'آموزش سولانا', 'توسعه وب۳', 'امنیت', 'اخبار و تحلیل', 'ترید', 'پراپ تریدینگ'];",
  "const categories = ['همه', 'آموزش سولانا', 'پروژه های سولانا', 'توسعه وب۳', 'امنیت', 'اخبار و تحلیل', 'ترید', 'پراپ تریدینگ'];"
);

// Add a semantic related-content model once for each opened article. The model
// favours the same category, then shared tags, and never recommends the article itself.
const anchor = "  const featuredArticle = filteredArticles[0] || articles[0];\n  const gridArticles = filteredArticles.length > 1 ? filteredArticles.slice(1) : filteredArticles;";
const replacement = "  const featuredArticle = filteredArticles[0] || articles[0];\n  const gridArticles = filteredArticles.length > 1 ? filteredArticles.slice(1) : filteredArticles;\n  const relatedArticles = readingArticle ? articles\n    .filter(article => article.id !== readingArticle.id)\n    .map(article => {\n      const sharedTags = article.tags.filter(tag => readingArticle.tags.includes(tag)).length;\n      const sameCategory = article.category === readingArticle.category ? 4 : 0;\n      return { article, score: sameCategory + sharedTags };\n    })\n    .filter(item => item.score > 0)\n    .sort((a, b) => b.score - a.score || String(b.article.publishedAt || '').localeCompare(String(a.article.publishedAt || '')))\n    .slice(0, 4)\n    .map(item => item.article) : [];";
if (next.includes(anchor) && !next.includes('const relatedArticles = readingArticle ? articles')) {
  next = next.replace(anchor, replacement);
}

// Inject a crawlable HTML navigation block below the article content. Existing
// article links remain normal internal hrefs, so Google can discover the cluster
// without relying on client-only event handlers.
const marker = "              <div className=\"article-content\" dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(readingArticle.content) }} />";
const block = "              <div className=\"article-content\" dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(readingArticle.content) }} />\n              {relatedArticles.length > 0 && <section aria-labelledby=\"related-solana-projects-heading\" className=\"mt-10 rounded-2xl border border-slate-800 bg-slate-950/50 p-5 sm:p-6\">\n                <div className=\"flex items-center justify-between gap-4 mb-4\">\n                  <h3 id=\"related-solana-projects-heading\" className=\"text-lg font-extrabold text-white\">مطالب مرتبط برای ادامه مطالعه</h3>\n                  <a href=\"/blog/category/solana-projects\" onClick={event => { event.preventDefault(); onNavigate?.('/blog/category/solana-projects'); }} className=\"text-xs font-bold text-sky-400 hover:text-sky-300\">همه پروژه های سولانا</a>\n                </div>\n                <div className=\"grid grid-cols-1 sm:grid-cols-2 gap-3\">\n                  {relatedArticles.map(article => <a key={article.id} href={`/article/${article.slug}`} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); handleOpenArticle(article); } }} className=\"block rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-sky-500/40 transition-colors\">\n                    <span className=\"text-[11px] text-sky-400 font-bold\">{article.category}</span>\n                    <span className=\"mt-1 block text-sm font-bold text-white leading-6\">{article.title}</span>\n                  </a>)}\n                </div>\n              </section>}";
if (next.includes(marker) && !next.includes('related-solana-projects-heading')) {
  next = next.replace(marker, block);
}

if (next === source) {
  console.log('No BlogHub changes required.');
  process.exit(0);
}
fs.writeFileSync(blogPath, next, 'utf8');
console.log('✓ Solana projects category + related-content SEO wiring applied.');
