import fs from 'node:fs';
import crypto from 'node:crypto';

const root = process.cwd();

function patchServer(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let source = fs.readFileSync(filePath, 'utf8');
  const original = source;

  const commentsStart = source.indexOf('  // 3. REAL COMMENTS ENDPOINTS');
  const commentsEnd = source.indexOf('  // 4. REAL ARTICLES ENDPOINTS', commentsStart);
  if (commentsStart < 0 || commentsEnd < 0) throw new Error(`Comment route markers not found in ${filePath}`);

  const block = `  // 3. PRODUCTION COMMENTS ENDPOINTS
  // Anonymous browser sessions are server-issued and signed. The display name is user-controlled,
  // while the internal comment/vote identity is never accepted from the client.
  const commentSessionSecret = process.env.COMMENT_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
  const commentCookieName = 'solmint_comment_session';

  const parseCookies = (req: express.Request): Record<string, string> => {
    const raw = String(req.headers.cookie || '');
    return Object.fromEntries(raw.split(';').map(part => part.trim()).filter(Boolean).map(part => {
      const index = part.indexOf('=');
      return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    }));
  };

  const signCommentSession = (id: string) => {
    const signature = crypto.createHmac('sha256', commentSessionSecret).update(id).digest('hex');
    return \`${id}.\${signature}\`;
  };

  const getCommentSession = (req: express.Request): string | null => {
    const token = parseCookies(req)[commentCookieName];
    if (!token) return null;
    const [id, signature] = token.split('.');
    if (!id || !signature) return null;
    const expected = crypto.createHmac('sha256', commentSessionSecret).update(id).digest('hex');
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    return id;
  };

  const issueCommentSession = (req: express.Request, res: express.Response): string => {
    const existing = getCommentSession(req);
    if (existing) return existing;
    const id = 'cmt-' + crypto.randomUUID();
    const token = signCommentSession(id);
    res.setHeader('Set-Cookie', \`${commentCookieName}=\${encodeURIComponent(token)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax\${process.env.NODE_ENV === 'production' ? '; Secure' : ''}\`);
    return id;
  };

  const normalizeCommentText = (value: unknown) => String(value || '').replace(/\r\n/g, '\n').trim();
  const normalizeCommentName = (value: unknown) => String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 80);

  app.get('/api/comments/session', (req, res) => {
    const sessionId = issueCommentSession(req, res);
    return res.json({ success: true, sessionId });
  });

  app.get('/api/comments', rateLimitMiddleware(60, 60000), async (req, res) => {
    try {
      const articleId = String(req.query.articleId || '').trim();
      const isAdmin = isAuthorizedAdmin(req);
      if (!articleId && !isAdmin) return res.status(400).json({ success: false, message: 'شناسه مقاله الزامی است.' });

      if (serverSupabase) {
        let query = serverSupabase.from('comments').select('*').order('created_at', { ascending: true });
        if (articleId) query = query.eq('article_id', articleId).eq('approved', true);
        const { data, error } = await query;
        if (error) throw error;
        const sessionId = getCommentSession(req);
        let userVotes: Record<string, number> = {};
        if (sessionId && data?.length) {
          const { data: votes } = await serverSupabase.from('comment_votes').select('comment_id,vote').eq('user_id', sessionId);
          for (const vote of votes || []) userVotes[String(vote.comment_id)] = Number(vote.vote);
        }
        const comments = (data || []).map((c: any) => ({
          id: c.id, articleId: c.article_id, userName: c.user_name, userId: c.user_id, text: c.text,
          createdAt: c.created_at ? new Date(c.created_at).toLocaleDateString('fa-IR') : 'اخیراً',
          approved: c.approved !== false, parentId: c.parent_id || null,
          likeCount: Number(c.like_count || 0), dislikeCount: Number(c.dislike_count || 0),
          userVote: userVotes[String(c.id)] || 0
        }));
        return res.json({ success: true, comments });
      }

      const comments = getAllComments().filter((c: any) => (!articleId || c.articleId === articleId) && (isAdmin || c.approved !== false));
      return res.json({ success: true, comments });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'خطا در دریافت دیدگاه‌ها' });
    }
  });

  app.post('/api/comments/add', rateLimitMiddleware(5, 10 * 60 * 1000), async (req, res) => {
    try {
      const sessionId = getCommentSession(req) || issueCommentSession(req, res);
      const articleId = String(req.body?.articleId || '').trim();
      const userName = normalizeCommentName(req.body?.userName);
      const text = normalizeCommentText(req.body?.text);
      const parentId = req.body?.parentId ? String(req.body.parentId).trim() : null;
      if (!articleId || !userName || !text) return res.status(400).json({ success: false, message: 'اطلاعات دیدگاه کامل نیست.' });
      if (userName.length < 2 || text.length < 3 || text.length > 4000) return res.status(400).json({ success: false, message: 'نام یا متن دیدگاه طول نامعتبر دارد.' });

      if (serverSupabase) {
        const { data: article, error: articleError } = await serverSupabase.from('articles').select('id,slug').or(\`id.eq.\${articleId},slug.eq.\${articleId}\`).maybeSingle();
        if (articleError || !article) return res.status(404).json({ success: false, message: 'مقاله مورد نظر یافت نشد.' });
        const canonicalArticleId = String(article.id);

        if (parentId) {
          const { data: parent } = await serverSupabase.from('comments').select('id,article_id,approved').eq('id', parentId).maybeSingle();
          if (!parent || String(parent.article_id) !== canonicalArticleId || parent.approved !== true) return res.status(400).json({ success: false, message: 'نظر والد معتبر نیست.' });
        }

        const id = 'comment-' + crypto.randomUUID();
        const { data: inserted, error } = await serverSupabase.from('comments').insert({
          id, article_id: canonicalArticleId, user_name: userName, user_id: sessionId, text, parent_id: parentId, approved: false
        }).select('*').single();
        if (error) throw error;
        return res.status(201).json({ success: true, comment: { id: inserted.id, articleId: inserted.article_id, userName: inserted.user_name, userId: inserted.user_id, text: inserted.text, createdAt: 'در انتظار تأیید', approved: false, parentId: inserted.parent_id || null, likeCount: 0, dislikeCount: 0 }, message: 'دیدگاه شما ثبت شد و پس از تأیید مدیر منتشر می‌شود.' });
      }

      const newComment = { id: 'comment-' + crypto.randomUUID(), articleId, userName, userId: sessionId, text, parentId, createdAt: new Date().toLocaleDateString('fa-IR'), approved: false };
      const updatedComments = saveComment(newComment as any);
      return res.status(201).json({ success: true, comment: newComment, comments: updatedComments, message: 'دیدگاه شما ثبت شد و پس از تأیید مدیر منتشر می‌شود.' });
    } catch (err: any) {
      console.error('Comment creation error:', err);
      return res.status(500).json({ success: false, message: 'خطا در ثبت دیدگاه. لطفاً دوباره تلاش کنید.' });
    }
  });

  app.post('/api/comments/vote', rateLimitMiddleware(30, 60000), async (req, res) => {
    try {
      const sessionId = getCommentSession(req);
      if (!sessionId) return res.status(401).json({ success: false, message: 'نشست نظر‌دهی معتبر نیست. صفحه را تازه‌سازی کنید.' });
      const commentId = String(req.body?.commentId || '').trim();
      const vote = Number(req.body?.vote);
      if (!commentId || ![-1, 0, 1].includes(vote)) return res.status(400).json({ success: false, message: 'رأی نامعتبر است.' });
      if (!serverSupabase) return res.status(503).json({ success: false, message: 'سرویس رأی‌دهی موقتاً در دسترس نیست.' });

      const { data: comment } = await serverSupabase.from('comments').select('id,approved').eq('id', commentId).maybeSingle();
      if (!comment || comment.approved !== true) return res.status(404).json({ success: false, message: 'دیدگاه یافت نشد.' });
      const { data, error } = await serverSupabase.rpc('set_comment_vote', { p_comment_id: commentId, p_user_id: sessionId, p_vote: vote });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      return res.json({ success: true, like_count: Number(result?.like_count || 0), dislike_count: Number(result?.dislike_count || 0), user_vote: Number(result?.user_vote || 0) });
    } catch (err: any) {
      console.error('Comment vote error:', err);
      return res.status(500).json({ success: false, message: 'خطا در ثبت رأی.' });
    }
  });

  app.post('/api/comments/approve', requireAdminAuth, async (req, res) => {
    try {
      const commentId = String(req.body?.commentId || '').trim();
      const approved = Boolean(req.body?.approved);
      if (!commentId) return res.status(400).json({ success: false, message: 'شناسه دیدگاه الزامی است.' });
      if (!serverSupabase) return res.status(503).json({ success: false, message: 'پایگاه داده در دسترس نیست.' });
      const { error } = await serverSupabase.from('comments').update({ approved }).eq('id', commentId);
      if (error) throw error;
      return res.json({ success: true, message: approved ? 'دیدگاه منتشر شد.' : 'دیدگاه مخفی شد.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'خطا در تغییر وضعیت دیدگاه.' });
    }
  });

  app.post('/api/comments/delete', requireAdminAuth, async (req, res) => {
    try {
      const commentId = String(req.body?.commentId || '').trim();
      if (!commentId) return res.status(400).json({ success: false, message: 'شناسه دیدگاه الزامی است.' });
      if (serverSupabase) {
        const { error } = await serverSupabase.from('comments').delete().eq('id', commentId);
        if (error) throw error;
      }
      deleteComment(commentId);
      return res.json({ success: true, message: 'دیدگاه حذف شد.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'خطا در حذف دیدگاه.' });
    }
  });

`;

  source = source.slice(0, commentsStart) + block + source.slice(commentsEnd);
  if (source !== original) fs.writeFileSync(filePath, source, 'utf8');
  return source !== original;
}

function patchBlogHub(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let source = fs.readFileSync(filePath, 'utf8');
  const original = source;

  if (!source.includes("./CommentsSection")) {
    source = source.replace("import { AuthorAvatar } from './AuthorAvatar';", "import { AuthorAvatar } from './AuthorAvatar';\nimport { CommentsSection } from './CommentsSection';");
  }

  source = source.replace(/  const \[commentText, setCommentText\] = useState\(''\);\n/, '');
  source = source.replace(/  const handleAddComment = async \(e: React\.FormEvent\) => \{[\s\S]*?\n  \};\n  const handleCopyArticleLink/, "  const handleCommentCreated = (comment: ArticleComment) => {\n    if (!comment.approved) { window.alert('دیدگاه شما ثبت شد و پس از تأیید مدیر نمایش داده می‌شود.'); return; }\n    const updatedArticles = articles.map(a => a.id === readingArticle?.id ? { ...a, comments: [comment, ...(a.comments || [])] } : a);\n    setArticles(updatedArticles);\n    setReadingArticle(prev => prev ? { ...prev, comments: [comment, ...(prev.comments || [])] } : null);\n  };\n  const handleCopyArticleLink");

  const start = source.indexOf('        <div className="pt-5 sm:pt-7 border-t border-slate-800 space-y-5 sm:space-y-6"><h3');
  const endMarker = '      </article></div>}';
  const end = source.indexOf(endMarker, start);
  if (start >= 0 && end > start) {
    const replacement = `        <CommentsSection articleId={readingArticle.id} comments={readingArticle.comments || []} currentUser={currentUser} openAuthModal={openAuthModal} onCommentCreated={handleCommentCreated} />\n`;
    source = source.slice(0, start) + replacement + source.slice(end);
  } else {
    throw new Error('BlogHub comment UI markers not found');
  }

  if (source !== original) fs.writeFileSync(filePath, source, 'utf8');
  return source !== original;
}

for (const file of [`${root}/server.ts`, `${root}/dist/server.cjs`]) {
  try { patchServer(file); } catch (error) { if (file.endsWith('server.ts')) throw error; console.warn(error.message); }
}

patchBlogHub(`${root}/src/components/BlogHub.tsx`);
console.log('Production comments patch applied.');
