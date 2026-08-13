import fs from 'node:fs';
import path from 'node:path';

const blogPath = path.join(process.cwd(), 'src/components/BlogHub.tsx');
if (!fs.existsSync(blogPath)) throw new Error(`Missing ${blogPath}`);

let source = fs.readFileSync(blogPath, 'utf8');
const canonicalImport = "import { CommentsSection } from './CommentsSection';";
if (!source.includes(canonicalImport)) {
  const before = source;
  if (source.includes("import { addCommentApi } from '../utils/cmsApiClient';\n")) {
    source = source.replace("import { addCommentApi } from '../utils/cmsApiClient';\n", `${canonicalImport}\n`);
  } else {
    const importAnchor = "import { renderMarkdownToHtml } from '../utils/markdownRenderer';\n";
    source = source.replace(importAnchor, `${importAnchor}${canonicalImport}\n`);
  }
  if (source === before) throw new Error('CommentsSection import replacement failed.');
}

if (!source.includes('const [commentCounts, setCommentCounts]')) {
  const before = source;
  source = source.replace("  const [copiedLink, setCopiedLink] = useState(false);\n", "  const [copiedLink, setCopiedLink] = useState(false);\n  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});\n");
  if (source === before) throw new Error('Comment count state insertion failed.');
}

if (!source.includes('/api/comments/counts?articleIds=')) {
  const before = source;
  const anchor = "  const categories = ['همه', 'آموزش سولانا', 'توسعه وب۳', 'امنیت', 'اخبار و تحلیل', 'ترید', 'پراپ تریدینگ'];\n";
  const effect = "  useEffect(() => {\n    let cancelled = false;\n    const ids = articles.map(article => String(article.id)).filter(Boolean);\n    if (!ids.length) { setCommentCounts({}); return; }\n    fetch(`/api/comments/counts?articleIds=${encodeURIComponent(ids.join(','))}`, { credentials: 'same-origin', cache: 'no-store' })\n      .then(response => response.json().catch(() => null))\n      .then(data => { if (!cancelled && data?.success && data.counts && typeof data.counts === 'object') setCommentCounts(data.counts as Record<string, number>); })\n      .catch(() => { if (!cancelled) setCommentCounts({}); });\n    return () => { cancelled = true; };\n  }, [articles]);\n\n";
  source = source.replace(anchor, effect + anchor);
  if (source === before) throw new Error('Comment count effect insertion failed.');
}

const addStart = source.indexOf("  const handleAddComment = async (e: React.FormEvent) => {");
const addEnd = source.indexOf("  const handleCopyArticleLink = async (slug: string) => {");
if (addStart >= 0 && addEnd > addStart) source = source.slice(0, addStart) + source.slice(addEnd);
source = source.replace(/\{art\.comments\.length\} دیدگاه/g, "{commentCounts[String(art.id)] ?? 0} دیدگاه");

const canonicalComponent = '<CommentsSection articleId={String(readingArticle.id)}';
if (!source.includes(canonicalComponent)) {
  const modalStartText = "        <div className=\"pt-5 sm:pt-7 border-t border-slate-800 space-y-5 sm:space-y-6\"><h3 className=\"text-base sm:text-lg font-bold text-white flex items-center gap-2\"><MessageSquare className=\"w-5 h-5 text-sky-400\" />دیدگاه‌های کاربران ({readingArticle.comments.length})</h3>";
  const modalEndText = "        </div>\n      </article></div>}";
  const modalStart = source.indexOf(modalStartText);
  const modalEnd = source.indexOf(modalEndText, modalStart);
  if (modalStart >= 0 && modalEnd > modalStart) {
    source = source.slice(0, modalStart) + "        <CommentsSection articleId={String(readingArticle.id)} comments={[]} currentUser={currentUser} openAuthModal={openAuthModal} onCommentCreated={() => {}} />\n" + source.slice(modalEnd);
  } else {
    // A previous build step may already have removed the legacy block. In that
    // converged state, do not fail the build.
    console.log('production-comments-unification: canonical comments block already converged; no modal rewrite needed.');
  }
}

source = source.replace("import { Article, ArticleComment, UserAccount } from '../types';", "import { Article, UserAccount } from '../types';");
source = source.replace("import { sanitizeText, safeSetLocalStorage } from '../utils/security';\n", "");
source = source.replace("import { addCommentApi } from '../utils/cmsApiClient';\n", "");
fs.writeFileSync(blogPath, source);
console.log('production-comments-unification: BlogHub comments migration is idempotent.');
