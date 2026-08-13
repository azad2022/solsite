import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const blogPath = path.join(root, 'src/components/BlogHub.tsx');
if (!fs.existsSync(blogPath)) throw new Error(`Missing ${blogPath}`);

let source = fs.readFileSync(blogPath, 'utf8');

if (!source.includes("import { CommentsSection } from './CommentsSection';")) {
  source = source.replace(
    "import { addCommentApi } from '../utils/cmsApiClient';\n",
    "import { CommentsSection } from './CommentsSection';\n"
  );
}

if (!source.includes('const [commentCounts, setCommentCounts]')) {
  source = source.replace(
    "  const [copiedLink, setCopiedLink] = useState(false);\n",
    "  const [copiedLink, setCopiedLink] = useState(false);\n  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});\n"
  );

  source = source.replace(
    "  const categories = ['همه', 'آموزش سولانا', 'توسعه وب۳', 'امنیت', 'اخبار و تحلیل', 'ترید', 'پراپ تریدینگ'];\n",
    "  useEffect(() => {\n    let cancelled = false;\n    const ids = articles.map(article => String(article.id)).filter(Boolean);\n    if (!ids.length) { setCommentCounts({}); return; }\n    fetch(`/api/comments/counts?articleIds=${encodeURIComponent(ids.join(','))}`, { credentials: 'same-origin', cache: 'no-store' })\n      .then(response => response.json().catch(() => null))\n      .then(data => { if (!cancelled && data?.success && data.counts && typeof data.counts === 'object') setCommentCounts(data.counts as Record<string, number>); })\n      .catch(() => { if (!cancelled) setCommentCounts({}); });\n    return () => { cancelled = true; };\n  }, [articles]);\n\n  const categories = ['همه', 'آموزش سولانا', 'توسعه وب۳', 'امنیت', 'اخبار و تحلیل', 'ترید', 'پراپ تریدینگ'];\n"
  );
}

const oldAddStart = "  const handleAddComment = async (e: React.FormEvent) => {";
const oldAddEnd = "  const handleCopyArticleLink = async (slug: string) => {";
const start = source.indexOf(oldAddStart);
const end = source.indexOf(oldAddEnd);
if (start >= 0 && end > start) source = source.slice(0, start) + source.slice(end);

source = source.replace(/\{art\.comments\.length\} دیدگاه/g, "{commentCounts[String(art.id)] ?? 0} دیدگاه");

const oldModalStart = "        <div className=\"pt-5 sm:pt-7 border-t border-slate-800 space-y-5 sm:space-y-6\"><h3 className=\"text-base sm:text-lg font-bold text-white flex items-center gap-2\"><MessageSquare className=\"w-5 h-5 text-sky-400\" />دیدگاه‌های کاربران ({readingArticle.comments.length})</h3>";
const oldModalEnd = "        </div>\n      </article></div>}";
const modalStart = source.indexOf(oldModalStart);
const modalEnd = source.indexOf(oldModalEnd, modalStart);
if (modalStart >= 0 && modalEnd > modalStart) {
  const replacement = "        <CommentsSection articleId={String(readingArticle.id)} comments={[]} currentUser={currentUser} openAuthModal={openAuthModal} onCommentCreated={() => {}} />\n";
  source = source.slice(0, modalStart) + replacement + source.slice(modalEnd);
}

source = source.replace("import { Article, ArticleComment, UserAccount } from '../types';", "import { Article, UserAccount } from '../types';");
source = source.replace("import { sanitizeText, safeSetLocalStorage } from '../utils/security';\n", "");
source = source.replace("import { renderMarkdownToHtml } from '../utils/markdownRenderer';\n", "import { renderMarkdownToHtml } from '../utils/markdownRenderer';\n");

fs.writeFileSync(blogPath, source);
console.log('production-comments-unification: BlogHub wired to canonical CommentsSection and live comment counts.');
