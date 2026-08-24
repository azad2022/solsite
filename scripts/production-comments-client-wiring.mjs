import fs from 'node:fs';

const filePath = 'src/components/BlogHub.tsx';
let source = fs.readFileSync(filePath, 'utf8');
const original = source;

if (!source.includes("import { RelatedArticlesCarousel } from './RelatedArticlesCarousel';")) {
  source = source.replace(
    "import { AuthorAvatar } from './AuthorAvatar';",
    "import { AuthorAvatar } from './AuthorAvatar';\nimport { RelatedArticlesCarousel } from './RelatedArticlesCarousel';"
  );
}

if (source.includes('<RelatedArticlesCarousel article={readingArticle}') && source.includes('<CommentsSection')) {
  console.log('✓ Public related articles and comments client wiring already present; existing UI preserved.');
  process.exit(0);
}

const start = source.indexOf('        <div className="pt-5 sm:pt-7 border-t border-slate-800 space-y-5 sm:space-y-6"><h3');
const endMarker = '      </article></div>}';
const end = source.indexOf(endMarker, start);
if (start < 0 || end <= start) {
  if (source.includes('<CommentsSection')) {
    console.log('✓ Public comments UI already wired in BlogHub.');
  } else {
    throw new Error('BlogHub article footer/comments marker not found; refusing to produce a partial production build.');
  }
}

const relatedMarker = '        <RelatedArticlesCarousel article={readingArticle} articles={articles} onNavigate={onNavigate} />\n';
if (!source.includes(relatedMarker)) {
  source = source.slice(0, start) + relatedMarker + source.slice(start);
}

if (!source.includes('<RelatedArticlesCarousel article={readingArticle}')) {
  throw new Error('BlogHub related articles wiring was not applied.');
}

if (source !== original) fs.writeFileSync(filePath, source, 'utf8');
console.log('✓ Public related articles client wiring applied; existing comments UI preserved.');
