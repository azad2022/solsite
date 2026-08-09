import fs from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const files = [resolve(root, 'server.ts'), resolve(root, 'dist/server.cjs')];

// /solana-price is a virtual public page. It intentionally has no row in
// public.articles, so its comments must use the virtual page id directly.
// This patch is applied at server startup after the hardened comments layer
// has been generated, and therefore works for both source and bundled server.
const marker = '  // SOLANA PRICE VIRTUAL COMMENTS ENDPOINT';

function patch(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(marker)) return false;

  const target = "  app.post('/api/comments/add', rateLimitMiddleware(5, 10 * 60 * 1000), async (req, res) => {";
  const legacyTarget = '  app.post("/api/comments/add", async (req, res) => {';
  const index = source.indexOf(target) >= 0 ? source.indexOf(target) : source.indexOf(legacyTarget);
  if (index < 0) {
    console.warn(`Solana price comments insertion point not found in ${filePath}`);
    return false;
  }

  const route = `  ${marker}\n  app.post('/api/comments/add', rateLimitMiddleware(5, 10 * 60 * 1000), async (req, res, next) => {\n    try {\n      const articleId = String(req.body?.articleId || '').trim();\n      if (articleId !== 'solana-price') return next();\n\n      const sessionId = getCommentSession(req) || issueCommentSession(req, res);\n      const userName = normalizeCommentName(req.body?.userName);\n      const text = normalizeCommentText(req.body?.text);\n      const parentId = req.body?.parentId ? String(req.body.parentId).trim() : null;\n\n      if (!userName || !text) {\n        return res.status(400).json({ success: false, message: 'اطلاعات دیدگاه کامل نیست.' });\n      }\n      if (userName.length < 2 || text.length < 3 || text.length > 4000) {\n        return res.status(400).json({ success: false, message: 'نام یا متن دیدگاه طول نامعتبر دارد.' });\n      }\n      if (!serverSupabase) {\n        return res.status(503).json({ success: false, message: 'پایگاه داده در دسترس نیست.' });\n      }\n\n      if (parentId) {\n        const { data: parent, error: parentError } = await serverSupabase\n          .from('comments')\n          .select('id,article_id,approved')\n          .eq('id', parentId)\n          .maybeSingle();\n        if (parentError || !parent || String(parent.article_id) !== 'solana-price' || parent.approved !== true) {\n          return res.status(400).json({ success: false, message: 'نظر والد معتبر نیست.' });\n        }\n      }\n\n      const id = 'comment-' + crypto.randomUUID();\n      const { data: inserted, error } = await serverSupabase.from('comments').insert({\n        id,\n        article_id: 'solana-price',\n        user_name: userName,\n        user_id: sessionId,\n        text,\n        parent_id: parentId,\n        approved: false\n      }).select('*').single();\n\n      if (error) {\n        console.error('Solana price comment insert error:', error);\n        return res.status(500).json({ success: false, message: 'خطا در ثبت دیدگاه. لطفاً دوباره تلاش کنید.' });\n      }\n\n      // Keep the server-side persistence layer in sync for the admin panel.\n      try {\n        saveComment({\n          id: String(inserted.id),\n          articleId: 'solana-price',\n          userName: String(inserted.user_name),\n          userId: String(inserted.user_id || sessionId),\n          text: String(inserted.text),\n          parentId: inserted.parent_id || null,\n          createdAt: inserted.created_at ? new Date(inserted.created_at).toLocaleDateString('fa-IR') : new Date().toLocaleDateString('fa-IR'),\n          approved: Boolean(inserted.approved)\n        } as any);\n      } catch (syncError) {\n        console.warn('Solana price comment local sync warning:', syncError);\n      }\n\n      return res.status(201).json({\n        success: true,\n        comment: {\n          id: inserted.id,\n          articleId: 'solana-price',\n          userName: inserted.user_name,\n          userId: inserted.user_id,\n          text: inserted.text,\n          createdAt: 'در انتظار تأیید',\n          approved: false,\n          parentId: inserted.parent_id || null,\n          likeCount: Number(inserted.like_count || 0),\n          dislikeCount: Number(inserted.dislike_count || 0)\n        },\n        message: 'دیدگاه شما ثبت شد و پس از تأیید مدیر منتشر می‌شود.'\n      });\n    } catch (error) {\n      console.error('Solana price comment creation error:', error);\n      return res.status(500).json({ success: false, message: 'خطا در ثبت دیدگاه. لطفاً دوباره تلاش کنید.' });\n    }\n  });\n\n`;

  source = source.slice(0, index) + route + source.slice(index);
  fs.writeFileSync(filePath, source, 'utf8');
  console.log(`Applied Solana price virtual comments endpoint to ${filePath}`);
  return true;
}

files.forEach(patch);
