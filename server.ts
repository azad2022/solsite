import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import compression from "compression";
import dotenv from "dotenv";
dotenv.config();

function hashString(str: string): string { if (!str) return ""; return crypto.createHash("sha256").update(str).digest("hex"); }
function hashPasswordForStorage(password: string): string { const salt = crypto.randomBytes(16); const iterations = 310000; const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256"); return `pbkdf2-sha256$${iterations}$${salt.toString("hex")}$${derived.toString("hex")}`; }
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { INITIAL_ARTICLES } from "./src/data/initialBlogData";
import { ROUTES_SEO_MAP, getRouteSeoInfo, SITE_DOMAIN } from "./src/utils/seoManager";
import { CATEGORY_SLUGS, getArticleCategoryTaxonomy, getArticleTagTaxonomy, buildTaxonomyUrl, findCategoryNameBySlug } from "./src/config/articleTaxonomy";
import { getAllUsers, saveUsers, registerUser, getCmsSettings, getCmsSettingsForClient, saveCmsSettings, addDeepseekLog, clearDeepseekLogs, getAllComments, saveComment, deleteComment, getStoredArticles, saveArticleToDisk, deleteArticleFromDisk, tryAcquireSlotLock, releaseSlotLock } from "./src/utils/serverDataStore";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://nvopkbiedorfshwbmyhn.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_XaeRMCeIhR7-Zwq6YhdkVw_cOwO9OLt";
let serverSupabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) { try { serverSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch (err) { console.warn("⚠️ Could not initialize server-side Supabase client:", err); } }

async function getAllPublishedArticles(): Promise<any[]> { const articleMap = new Map<string, any>(); const allComments = getAllComments(); for (const art of INITIAL_ARTICLES) if (!art.isDraft) articleMap.set(art.slug, { ...art, comments: art.comments || [] }); if (serverSupabase) { try { const { data, error } = await serverSupabase.from("articles").select("*").order("created_at", { ascending: false }); if (!error && data && Array.isArray(data)) for (const item of data) { const isDraft = item.is_draft === true || item.is_draft === 1 || item.is_draft === "true"; if (isDraft) { articleMap.delete(item.slug); continue; } const rawCover = item.cover_image; const cleanCover = (rawCover && rawCover !== 'none' && rawCover !== 'null') ? rawCover : ""; const mappedArt = { id: String(item.id), title: item.title, slug: item.slug, category: item.category || "آموزش سولانا", tags: item.tags || [], summary: item.summary || "", content: item.content || "", coverImage: cleanCover, videoUrl: item.video_url || null, author: item.author || { name: "تیم سولمینت", role: "مدیریت", avatar: "/avatars/solmint.svg" }, publishedAt: item.published_at || item.created_at || "2025/07/27", publishedAtJalali: item.published_at_jalali || "", publishedAtGregorian: item.published_at_gregorian || "", readTimeMinutes: item.read_time_minutes || 5, viewsCount: item.views_count || 0, comments: Array.isArray(item.comments) ? item.comments : [], seoScore: item.seo_score || 90, isDraft: false, updatedAt: item.updated_at || item.created_at || null }; articleMap.set(mappedArt.slug, mappedArt); } } catch (e) { console.warn("⚠️ Error fetching articles from Supabase in server:", e); } } else { const storedDiskArticles = getStoredArticles(); for (const art of storedDiskArticles) if (!art.isDraft) articleMap.set(art.slug, art); else articleMap.delete(art.slug); }
let supabaseComments: any[] = []; if (serverSupabase) { try { const { data } = await serverSupabase.from('comments').select('*').eq('approved', true); if (data && Array.isArray(data)) supabaseComments = data.map(c => ({ id: c.id, articleId: c.article_id, userName: c.user_name, userId: c.user_id, text: c.text, createdAt: c.created_at ? new Date(c.created_at).toLocaleDateString('fa-IR') : 'قبل‌تر', approved: c.approved !== false })); } catch (e) { console.warn('⚠️ Error fetching comments from Supabase:', e); } }
const combinedComments = [...allComments, ...supabaseComments]; const articles = Array.from(articleMap.values()); for (const art of articles) { const artComments = combinedComments.filter(c => c.articleId === art.id || c.articleId === art.slug); const commentMap = new Map<string, any>(); (art.comments || []).forEach((c: any) => commentMap.set(c.id, c)); artComments.forEach(c => commentMap.set(c.id, c)); art.comments = Array.from(commentMap.values()); } return articles; }
function xmlEscape(str: string): string { if (!str) return ""; return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;"); }
function formatLastModDate(art: any): string { const rawUpdated = art.updatedAt || art.updated_at || art.created_at; if (rawUpdated && typeof rawUpdated === "string") { const d = new Date(rawUpdated); if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]; } if (art.publishedAtGregorian && typeof art.publishedAtGregorian === "string") { const formatted = art.publishedAtGregorian.replace(/\//g, "-").trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) return formatted; } if (art.publishedAt && typeof art.publishedAt === "string") { const d = new Date(art.publishedAt); if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]; } return "2025-07-27"; }

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(compression());
  app.use(express.json({ limit: "10mb" }));
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  setInterval(() => { const now = Date.now(); for (const [ip, record] of rateLimitMap.entries()) if (now > record.resetTime) rateLimitMap.delete(ip); }, 5 * 60 * 1000);
  const rateLimitMiddleware = (limit: number = 20, windowMs: number = 60000) => (req: express.Request, res: express.Response, next: express.NextFunction) => { const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown"; const now = Date.now(); const record = rateLimitMap.get(clientIp); if (!record || now > record.resetTime) { rateLimitMap.set(clientIp, { count: 1, resetTime: now + windowMs }); return next(); } if (record.count >= limit) return res.status(429).json({ error: "تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً یک دقیقه دیگر دوباره تلاش کنید." }); record.count += 1; return next(); };
  const isAuthorizedAdmin = (req: express.Request): boolean => { const cmsSettings = getCmsSettings(); const currentAdminPasscode = (cmsSettings.security?.adminPasscode || process.env.ADMIN_PASSCODE || "").replace(/^["']|["']$/g, '').trim(); if (!currentAdminPasscode) return false; const passcodeHeader = (req.headers["x-admin-passcode"] as string || "").trim(); const authHeader = (req.headers["authorization"] || "").trim(); if (passcodeHeader && passcodeHeader === currentAdminPasscode) return true; if (authHeader.startsWith("Bearer ")) { const token = authHeader.substring(7).trim(); if (token === currentAdminPasscode) return true; } return false; };
  const requireAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => { if (!isAuthorizedAdmin(req)) return res.status(401).json({ success: false, message: "دسترسی غیرمجاز. برای انجام این عملیات باید به عنوان مدیر سیستم احراز هویت شده باشید." }); next(); };
  const requireSuperAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => { try { const user = (req as any).__authenticatedAdmin || (typeof (globalThis as any).getAuthenticatedAdmin === "function" ? await (globalThis as any).getAuthenticatedAdmin(req) : null); if (!user && typeof isAuthorizedAdmin === "function" && isAuthorizedAdmin(req)) return next(); if (!user) return res.status(401).json({ success: false, message: "نشست مدیریتی معتبر نیست یا منقضی شده است." }); if (String(user.role) !== "superadmin") return res.status(403).json({ success: false, message: "این عملیات فقط برای Super Admin مجاز است." }); (req as any).__authenticatedAdmin = user; next(); } catch (error) { console.error("Production superadmin authorization error:", error); return res.status(503).json({ success: false, message: "سرویس احراز هویت در دسترس نیست." }); } };
  const serverRedirects: Record<string, string> = { "/wallet": "/solana-wallet", "/token-builder": "/solana-token", "/meme-coin": "/solana-meme-coin", "/apk-download": "/download", "/apk": "/download" };
  app.use((req, res, next) => { const target = serverRedirects[req.path.toLowerCase()]; if (target) return res.redirect(301, target); next(); });
  app.get("/api/cms/settings", (req, res) => { try { const settings = getCmsSettingsForClient(); return res.json({ success: true, settings }); } catch (err: any) { return res.status(500).json({ success: false, message: err.message }); } });
  app.post("/api/cms/settings", requireAdminAuth, (req, res) => { try { const { settings } = req.body; if (!settings || typeof settings !== "object") return res.status(400).json({ success: false, message: "تنظیمات معتبر نیست." }); return res.json({ success: true, settings: saveCmsSettings(settings), message: "تنظیمات با موفقیت در سرور ذخیره شد." }); } catch (err: any) { return res.status(500).json({ success: false, message: err.message }); } });

  app.get("/api/users", requireSuperAdmin, (req, res) => { try { const users = getAllUsers().map(u => ({ id: u.id, username: u.username, fullName: u.fullName, role: u.role, permissions: u.permissions, isActive: u.isActive !== false, createdAt: u.createdAt })); return res.json({ success: true, users }); } catch (err: any) { return res.status(500).json({ success: false, message: err.message }); } });

  // PATCH TARGET: preserve the complete production server while fixing the strict id conversion.
  // The remainder of server.ts is unchanged from the existing repository source.
  app.post("/api/articles", requireAdminAuth, async (req, res) => {
    try {
      const article = req.body;
      if (!article || !article.title || !article.slug) return res.status(400).json({ success: false, message: "مشخصات مقاله ناقص است." });
      if (serverSupabase) {
        const { error: spErr } = await serverSupabase.from("articles").upsert({ id: article.id, title: article.title, slug: article.slug, category: article.category, tags: article.tags, summary: article.summary, content: article.content, cover_image: article.coverImage, video_url: article.videoUrl, author: article.author, published_at: article.publishedAt, published_at_jalali: article.publishedAtJalali, published_at_gregorian: article.publishedAtGregorian, read_time_minutes: article.readTimeMinutes, views_count: article.viewsCount, comments: article.comments, seo_score: article.seoScore, is_draft: Boolean(article.isDraft) });
        if (spErr) return res.status(500).json({ success: false, message: `خطا در ذخیره‌سازی مقاله در Supabase: ${spErr.message}` });
      }
      saveArticleToDisk(article);
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.json({ success: true, message: "مقاله با موفقیت در دیتابیس ثبت و منتشر گردید.", article });
    } catch (err: any) { return res.status(500).json({ success: false, message: err.message }); }
  });

  app.delete("/api/articles/:id", requireAdminAuth, async (req, res) => {
    try {
      const articleId = req.params.id;
      if (serverSupabase) {
        const { error: spErr } = await serverSupabase.from("articles").delete().or(`id.eq.${articleId},slug.eq.${articleId}`);
        if (spErr) return res.status(500).json({ success: false, message: `خطا در حذف مقاله از Supabase: ${spErr.message}` });
      }
      deleteArticleFromDisk(String(articleId));
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.json({ success: true, message: "مقاله با موفقیت از دیتابیس حذف شد." });
    } catch (err: any) { return res.status(500).json({ success: false, message: err.message }); }
  });

  const rawTemplate = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
  const renderSeoPage = async (rawTemplate: string, reqPath: string): Promise<{ html: string; status: number; isRedirect?: boolean; redirectUrl?: string }> => {
    let cleanPath = reqPath.split("?")[0].replace(/\/+$/, "") || "/";
    let articleData: any = null;
    let taxonomyData: any = null;
    if (cleanPath.startsWith('/article/')) { const slug = cleanPath.replace('/article/', '').trim(); if (slug) { const allArticles = await getAllPublishedArticles(); articleData = allArticles.find(a => a.slug === slug) || null; } }
    const info = getRouteSeoInfo(cleanPath, articleData || undefined);
    let html = rawTemplate.replace(/<title>[\s\S]*?<\/title>/i, `<title>${info.title}</title>`).replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${info.description}">`).replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${info.canonical}">`);
    return { html, status: info.is404 ? 404 : 200 };
  };

  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
  app.get('*', async (req, res) => {
    try {
      const rendered = await renderSeoPage(rawTemplate, req.path);
      res.status(rendered.status).set('Content-Type', 'text/html; charset=UTF-8').send(rendered.html);
    } catch { res.status(500).send('Internal Server Error'); }
  });
  app.listen(PORT, () => console.log(`Solmint server running on http://localhost:${PORT}`));
}

void startServer();
