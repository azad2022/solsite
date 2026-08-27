import fs from 'node:fs';

const file = 'functions/article/[slug].ts';
let source = fs.readFileSync(file, 'utf8');

const imageLine = "  const image = safeUrl(article.cover_image || `${SITE_ORIGIN}/og-solmint.png`);";
const marker = "  const shell = `<main id=\"article-ssr\"";

if (!source.includes(imageLine)) {
  throw new Error('[article-no-cover] expected image assignment not found');
}

if (!source.includes('const hasArticleCover =')) {
  source = source.replace(
    imageLine,
    `${imageLine}\n  // Keep the generic OG image for metadata, but never render it as an article cover.\n  const hasArticleCover = Boolean(String(article.cover_image || '').trim()) && image !== '#';`
  );
}

const oldFigureGuard = '${image !== \'#\' ? `<figure><img src="${escapeHtml(image)}" alt="${escapeHtml(article.title)}" fetchpriority="high"></figure>` : \'\'}';
const newFigureGuard = '${hasArticleCover ? `<figure><img src="${escapeHtml(image)}" alt="${escapeHtml(article.title)}" fetchpriority="high"></figure>` : \'\'}';

if (source.includes(oldFigureGuard)) {
  source = source.replace(oldFigureGuard, newFigureGuard);
}

if (!source.includes('const hasArticleCover =')) {
  throw new Error('[article-no-cover] cover guard was not inserted');
}
if (!source.includes(newFigureGuard)) {
  throw new Error('[article-no-cover] shell figure guard was not updated');
}
if (!source.includes(marker)) {
  throw new Error('[article-no-cover] article shell marker missing');
}

fs.writeFileSync(file, source, 'utf8');
console.log('✓ Article SSR no-cover pages no longer render the generic OG image as a visible cover.');
