import fs from 'node:fs';

const filePath = 'src/components/BlogHub.tsx';
let source = fs.readFileSync(filePath, 'utf8');
const original = source;

if (!source.includes("import { CommentsSection } from './CommentsSection';")) {
  source = source.replace("import { AuthorAvatar } from './AuthorAvatar';", "import { AuthorAvatar } from './AuthorAvatar';\nimport { CommentsSection } from './CommentsSection';");
}

source = source.replace(/  const \[commentText, setCommentText\] = useState\(''\);\n/, '');

source = source.replace(/  const handleAddComment = async \(e: React\.FormEvent\) => \{[\s\S]*?\n  \};\n  const handleCopyArticleLink/, "  const handleCommentCreated = (comment: ArticleComment) => {\n    if (!comment.approved) return;\n    setArticles(prev => prev.map(a => a.id === readingArticle?.id ? { ...a, comments: [comment, ...(a.comments || [])] } : a));\n    setReadingArticle(prev => prev ? { ...prev, comments: [comment, ...(prev.comments || [])] } : null);\n  };\n  const handleCopyArticleLink");

const start = source.indexOf('        <div className="pt-5 sm:pt-7 border-t border-slate-800 space-y-5 sm:space-y-6"><h3');
const endMarker = '      </article></div>}';
const end = source.indexOf(endMarker, start);
if (start < 0 || end <= start) {
  throw new Error('BlogHub comment UI markers not found; refusing to produce a partial production build.');
}

const replacement = `        <CommentsSection articleId={readingArticle.id} comments={readingArticle.comments || []} currentUser={currentUser} openAuthModal={openAuthModal} onCommentCreated={handleCommentCreated} />\n`;
source = source.slice(0, start) + replacement + source.slice(end);

if (!source.includes('<CommentsSection articleId={readingArticle.id}')) {
  throw new Error('BlogHub comments wiring was not applied.');
}

if (source !== original) fs.writeFileSync(filePath, source, 'utf8');
console.log('✓ Public comments client wiring applied.');
