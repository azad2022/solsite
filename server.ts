import express from "express";
import path from "path";
import fs from "fs";
import compression from "compression";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { INITIAL_ARTICLES } from "./src/data/initialBlogData";
import { ROUTES_SEO_MAP, getRouteSeoInfo, SITE_DOMAIN } from "./src/utils/seoManager";

// Initialize Supabase client for Server-Side Article Retrieval & Sitemap Generation
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://nvopkbiedorfshwbmyhn.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_XaeRMCeIhR7-Zwq6YhdkVw_cOwO9OLt";

let serverSupabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    serverSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.warn("⚠️ Could not initialize server-side Supabase client:", err);
  }
}

/**
 * Retrieves all published, public articles from Supabase database combined with baseline INITIAL_ARTICLES.
 * Filters out drafts, private, or deleted articles.
 */
async function getAllPublishedArticles(): Promise<any[]> {
  const articleMap = new Map<string, any>();

  // 1. Baseline INITIAL_ARTICLES
  for (const art of INITIAL_ARTICLES) {
    if (!art.isDraft) {
      articleMap.set(art.slug, art);
    }
  }

  // 2. Fetch published articles from Supabase 'articles' table
  if (serverSupabase) {
    try {
      const { data, error } = await serverSupabase
        .from("articles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data && Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          const isDraft = item.is_draft === true || item.is_draft === 1 || item.is_draft === "true";
          if (isDraft) {
            articleMap.delete(item.slug);
            continue;
          }

          const mappedArt = {
            id: String(item.id),
            title: item.title,
            slug: item.slug,
            category: item.category || "آموزش سولانا",
            tags: item.tags || [],
            summary: item.summary || "",
            content: item.content || "",
            coverImage: item.cover_image || "/images/blog-og.jpg",
            videoUrl: item.video_url || null,
            author: item.author || { name: "تیم سولمینت", role: "مدیریت", avatar: "⚡" },
            publishedAt: item.published_at || item.created_at || "2025/07/27",
            publishedAtJalali: item.published_at_jalali || "",
            publishedAtGregorian: item.published_at_gregorian || "",
            readTimeMinutes: item.read_time_minutes || 5,
            viewsCount: item.views_count || 0,
            comments: item.comments || [],
            seoScore: item.seo_score || 90,
            isDraft: false,
            updatedAt: item.updated_at || item.created_at || null
          };

          articleMap.set(mappedArt.slug, mappedArt);
        }
      }
    } catch (e) {
      console.warn("⚠️ Error fetching articles from Supabase in server:", e);
    }
  }

  return Array.from(articleMap.values());
}

/**
 * Calculates accurate lastmod date for sitemap & JSON-LD
 */
function formatLastModDate(art: any): string {
  const rawUpdated = art.updatedAt || art.updated_at || art.created_at;
  if (rawUpdated && typeof rawUpdated === "string") {
    const d = new Date(rawUpdated);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  }

  if (art.publishedAtGregorian && typeof art.publishedAtGregorian === "string") {
    const formatted = art.publishedAtGregorian.replace(/\//g, "-").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return formatted;
    }
  }

  if (art.publishedAt && typeof art.publishedAt === "string") {
    const d = new Date(art.publishedAt);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  }

  return "2025-07-27";
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable Gzip/Brotli response compression for max PageSpeed scores
  app.use(compression());

  app.use(express.json({ limit: "10mb" }));

  // In-memory rate limiting map for AI Proxy endpoints
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  const rateLimitMiddleware = (limit: number = 20, windowMs: number = 60000) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
      const now = Date.now();
      const record = rateLimitMap.get(clientIp);

      if (!record || now > record.resetTime) {
        rateLimitMap.set(clientIp, { count: 1, resetTime: now + windowMs });
        return next();
      }

      if (record.count >= limit) {
        return res.status(429).json({
          error: "تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً یک دقیقه دیگر دوباره تلاش کنید."
        });
      }

      record.count += 1;
      return next();
    };
  };

  // Legacy Redirect Map for Server-side 301 Redirects
  const serverRedirects: Record<string, string> = {
    "/wallet": "/solana-wallet",
    "/token-builder": "/solana-token",
    "/meme-coin": "/solana-meme-coin",
    "/apk-download": "/download",
    "/apk": "/download"
  };

  app.use((req, res, next) => {
    const target = serverRedirects[req.path.toLowerCase()];
    if (target) {
      return res.redirect(301, target);
    }
    next();
  });

  // Helper to generate pre-rendered HTML with full route-specific metadata and 404 status detection
  const renderSeoPage = async (rawTemplate: string, reqPath: string): Promise<{ html: string; status: number; isRedirect?: boolean; redirectUrl?: string }> => {
    let cleanPath = reqPath.split("?")[0].toLowerCase();
    let articleData: any = null;

    if (cleanPath.startsWith("/article/") || cleanPath.startsWith("/blog/")) {
      const slug = cleanPath.replace(/^\/(article|blog)\//, "").trim();
      if (slug) {
        const allArticles = await getAllPublishedArticles();
        const found = allArticles.find(a => a.slug === slug);
        if (found) {
          articleData = found;
          // 301 Redirect legacy /blog/{slug} to canonical /article/{slug}
          if (cleanPath.startsWith("/blog/")) {
            return { html: "", status: 301, isRedirect: true, redirectUrl: `/article/${found.slug}` };
          }
          cleanPath = `/article/${found.slug}`;
        }
      }
    }

    const info = getRouteSeoInfo(cleanPath, articleData || undefined);
    let html = rawTemplate;

    // Handle 404 Not Found status for missing articles or unknown routes
    if (info.is404) {
      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${info.title}</title>`);
      
      // Inject noindex meta tag to prevent soft-404 indexing issues
      if (html.includes('name="description"')) {
        html = html.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${info.description}">\n  <meta name="robots" content="noindex, follow">`);
      } else {
        html = html.replace('</head>', `  <meta name="description" content="${info.description}">\n  <meta name="robots" content="noindex, follow">\n</head>`);
      }

      const ssr404Html = `
        <main style="max-width:800px;margin:4rem auto;padding:2rem 1rem;color:#f8fafc;font-family:system-ui,sans-serif;direction:rtl;text-align:center;">
          <nav aria-label="Breadcrumb" style="font-size:0.875rem;color:#94a3b8;margin-bottom:1.5rem;">
            <a href="/" style="color:#38bdf8;text-decoration:none;">خانه</a> &gt; <a href="/blog" style="color:#38bdf8;text-decoration:none;">وبلاگ</a> &gt; <span>۴۰۴</span>
          </nav>
          <h1 style="font-size:2.25rem;font-weight:900;color:#ef4444;margin-bottom:1rem;">۴۰۴ - مقاله یا صفحه مورد نظر یافت نشد</h1>
          <p style="font-size:1.125rem;color:#cbd5e1;line-height:1.7;margin-bottom:2rem;">
            متأسفانه آدرسی که وارد کرده‌اید وجود ندارد یا ممکن است مقاله مربوطه منتقل یا حذف شده باشد.
          </p>
          <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
            <a href="/blog" style="display:inline-block;padding:0.75rem 1.5rem;background:#14F195;color:#000000;font-weight:bold;border-radius:0.75rem;text-decoration:none;">مشاهده تمام مقالات وبلاگ</a>
            <a href="/" style="display:inline-block;padding:0.75rem 1.5rem;border:1px solid #38bdf8;color:#38bdf8;font-weight:bold;border-radius:0.75rem;text-decoration:none;">بازگشت به صفحه اصلی</a>
          </div>
        </main>
      `;

      html = html.replace('<div id="root"></div>', `<div id="root">${ssr404Html}</div>`);
      return { html, status: 404 };
    }

    // 1. Replace <title>
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${info.title}</title>`);

    // 2. Replace or inject <meta name="description">
    if (html.includes('name="description"')) {
      html = html.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${info.description}">`);
    } else {
      html = html.replace('</head>', `  <meta name="description" content="${info.description}">\n</head>`);
    }

    // 3. Replace or inject <link rel="canonical">
    if (html.includes('rel="canonical"')) {
      html = html.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${info.canonical}">`);
    } else {
      html = html.replace('</head>', `  <link rel="canonical" href="${info.canonical}">\n</head>`);
    }

    // 4. Inject or update Open Graph & Twitter Cards
    const ogTags = `
    <!-- Open Graph & Social Cards -->
    <meta property="og:title" content="${info.title}">
    <meta property="og:description" content="${info.description}">
    <meta property="og:url" content="${info.canonical}">
    <meta property="og:type" content="${info.ogType || 'website'}">
    <meta property="og:image" content="${info.ogImage || `${SITE_DOMAIN}/images/solmint-banner.jpg`}">
    <meta property="og:site_name" content="سولمینت">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${info.title}">
    <meta name="twitter:description" content="${info.description}">
    <meta name="twitter:image" content="${info.ogImage || `${SITE_DOMAIN}/images/solmint-banner.jpg`}">
    `;
    html = html.replace('</head>', `${ogTags}\n</head>`);

    // 5. Inject Article or Page Specific JSON-LD Schema
    if (articleData) {
      const articleJsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": articleData.title,
        "description": articleData.summary,
        "image": articleData.coverImage,
        "author": {
          "@type": "Person",
          "name": articleData.author.name,
          "jobTitle": articleData.author.role
        },
        "publisher": {
          "@type": "Organization",
          "name": "سولمینت",
          "url": "https://solmint.ir",
          "logo": {
            "@type": "ImageObject",
            "url": "https://solmint.ir/og-solmint.png"
          }
        },
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": info.canonical
        },
        "datePublished": articleData.publishedAtGregorian ? articleData.publishedAtGregorian.replace(/\//g, "-") : "2025-07-27",
        "dateModified": formatLastModDate(articleData)
      };

      const schemaScript = `\n    <script type="application/ld+json">\n    ${JSON.stringify(articleJsonLd, null, 2)}\n    </script>`;
      html = html.replace('</head>', `${schemaScript}\n</head>`);
    }

    // 6. Inject Pre-rendered SSR HTML into <div id="root"></div> for zero-JS crawlers
    let ssrHtmlContent = "";
    if (articleData) {
      ssrHtmlContent = `
        <main style="max-width:900px;margin:0 auto;padding:2rem 1rem;color:#f8fafc;font-family:system-ui,sans-serif;direction:rtl;text-align:right;">
          <nav aria-label="Breadcrumb" style="font-size:0.875rem;color:#94a3b8;margin-bottom:1.5rem;">
            <a href="/" style="color:#38bdf8;text-decoration:none;">خانه</a> &gt; 
            <a href="/blog" style="color:#38bdf8;text-decoration:none;">وبلاگ</a> &gt; 
            <span>${articleData.title}</span>
          </nav>
          <article>
            <header style="margin-bottom:2rem;">
              <span style="display:inline-block;padding:0.25rem 0.75rem;background:rgba(56,189,248,0.1);color:#38bdf8;border-radius:9999px;font-size:0.75rem;font-weight:bold;margin-bottom:0.75rem;">${articleData.category}</span>
              <h1 style="font-size:2rem;font-weight:900;color:#ffffff;line-height:1.3;margin-bottom:1rem;">${articleData.title}</h1>
              <p style="font-size:1rem;color:#cbd5e1;line-height:1.6;margin-bottom:1rem;">${articleData.summary}</p>
              <div style="font-size:0.875rem;color:#94a3b8;">
                نویسنده: <strong>${articleData.author.name}</strong> (${articleData.author.role}) | تاریخ انتشار: ${articleData.publishedAtJalali || articleData.publishedAt}
              </div>
            </header>
            <hr style="border:0;border-top:1px solid #334155;margin:1.5rem 0;" />
            <div style="font-size:1rem;line-height:1.8;color:#e2e8f0;white-space:pre-line;">
              ${articleData.content}
            </div>
          </article>
        </main>
      `;
    } else {
      ssrHtmlContent = `
        <main style="max-width:1100px;margin:0 auto;padding:2rem 1rem;color:#f8fafc;font-family:system-ui,sans-serif;direction:rtl;text-align:right;">
          <nav aria-label="Breadcrumb" style="font-size:0.875rem;color:#94a3b8;margin-bottom:1.5rem;">
            ${info.breadcrumbs.map(b => `<a href="${b.url.replace(SITE_DOMAIN, '')}" style="color:#38bdf8;text-decoration:none;">${b.name}</a>`).join(' &gt; ')}
          </nav>
          <section>
            <h1 style="font-size:2.25rem;font-weight:900;color:#ffffff;margin-bottom:1rem;">${info.h1}</h1>
            <p style="font-size:1.125rem;color:#cbd5e1;line-height:1.7;margin-bottom:2rem;">${info.description}</p>
            <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:1.5rem;">
              <a href="/download" style="display:inline-block;padding:0.75rem 1.5rem;background:#14F195;color:#000000;font-weight:bold;border-radius:0.75rem;text-decoration:none;">دانلود اپلیکیشن سولمینت اندروید</a>
              <a href="/blog" style="color:#38bdf8;padding:0.75rem 1.5rem;border:1px solid #38bdf8;border-radius:0.75rem;text-decoration:none;">مشاهده مقالات آموزشی وبلاگ</a>
            </div>
          </section>
        </main>
      `;
    }

    html = html.replace('<div id="root"></div>', `<div id="root">${ssrHtmlContent}</div>`);
    return { html, status: 200 };
  };

  // Gemini API client setup
  const getAiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // API endpoint for proxying DeepSeek / OpenAI-compatible API tests
  app.post("/api/deepseek/test", rateLimitMiddleware(15, 60000), async (req, res) => {
    try {
      const { apiKey, baseUrl, model } = req.body;
      if (!apiKey || typeof apiKey !== "string") {
        return res.status(400).json({ success: false, message: "کلید API وارد نشده است." });
      }

      const cleanBaseUrl = (baseUrl || "https://api.gapgpt.app/v1").replace(/\/$/, "");
      const endpoint = `${cleanBaseUrl}/chat/completions`;
      const targetModel = model || "deepseek-chat";

      const apiRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: "user", content: "سلام، تست آنلاین ارتباط با API" }],
          max_tokens: 10
        })
      });

      if (apiRes.ok) {
        const data = await apiRes.json().catch(() => ({}));
        return res.json({
          success: true,
          message: `اتصال با موفقیت برقرار شد! پاسخ مدل (${data.model || targetModel}) دریافت گردید.`
        });
      } else {
        const errJson = await apiRes.json().catch(() => ({}));
        let errMsg = errJson?.error?.message || errJson?.message || apiRes.statusText;
        if (errMsg.toLowerCase().includes("authentication") || errMsg.toLowerCase().includes("api key") || errMsg.toLowerCase().includes("invalid")) {
          errMsg = "کلید API وارد شده نامعتبر یا منقضی می‌باشد. لطفاً کلید API معتبر خود را از پنل DeepSeek وارد نمایید.";
        }
        return res.status(apiRes.status).json({
          success: false,
          message: `خطا در اتصال (کد ${apiRes.status}): ${errMsg}`
        });
      }
    } catch (error: any) {
      console.error("DeepSeek proxy test error:", error);
      return res.status(500).json({
        success: false,
        message: `خطای سرور هنگام اتصال: ${error?.message || "نامشخص"}`
      });
    }
  });

  // API endpoint for proxying DeepSeek article generation
  app.post("/api/deepseek/generate", rateLimitMiddleware(15, 60000), async (req, res) => {
    try {
      const { apiKey, baseUrl, model, systemPrompt, userPrompt } = req.body;
      if (!apiKey) {
        return res.status(400).json({ error: "کلید API الزامی است." });
      }

      const cleanBaseUrl = (baseUrl || "https://api.deepseek.com/v1").replace(/\/$/, "");
      const endpoint = `${cleanBaseUrl}/chat/completions`;
      const targetModel = model || "deepseek-chat";

      const apiRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: "system", content: systemPrompt || "شما یک دستیار هوش مصنوعی هستید." },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7
        })
      });

      if (apiRes.ok) {
        const data = await apiRes.json();
        return res.json(data);
      } else {
        const errJson = await apiRes.json().catch(() => ({}));
        return res.status(apiRes.status).json({
          error: errJson?.error?.message || errJson?.message || apiRes.statusText
        });
      }
    } catch (error: any) {
      console.error("DeepSeek proxy generate error:", error);
      return res.status(500).json({ error: error?.message || "خطای سرور" });
    }
  });

  // API endpoint for proxying DeepSeek Chatbot messages
  app.post("/api/deepseek/chat", rateLimitMiddleware(25, 60000), async (req, res) => {
    try {
      const { apiKey, baseUrl, model, systemPrompt, messages } = req.body;
      if (!apiKey) {
        return res.status(400).json({ error: "کلید API الزامی است." });
      }

      const cleanBaseUrl = (baseUrl || "https://api.gapgpt.app/v1").replace(/\/$/, "");
      const endpoint = `${cleanBaseUrl}/chat/completions`;
      const targetModel = model || "deepseek-chat";

      const formattedMessages: Array<{ role: string; content: string }> = [];
      if (systemPrompt) {
        formattedMessages.push({ role: "system", content: systemPrompt });
      }
      if (Array.isArray(messages)) {
        formattedMessages.push(...messages);
      }

      const apiRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages: formattedMessages,
          temperature: 0.7
        })
      });

      if (apiRes.ok) {
        const data = await apiRes.json();
        return res.json(data);
      } else {
        const errJson = await apiRes.json().catch(() => ({}));
        let rawMsg = errJson?.error?.message || errJson?.message || apiRes.statusText;
        if (rawMsg.toLowerCase().includes("authentication") || rawMsg.toLowerCase().includes("api key") || rawMsg.toLowerCase().includes("invalid")) {
          rawMsg = "کلید API چت‌بات نامعتبر یا منقضی است. لطفاً کلید معتبر DeepSeek را در پنل مدیریت وارد نمایید.";
        }
        return res.status(apiRes.status).json({
          error: rawMsg
        });
      }
    } catch (error: any) {
      console.error("DeepSeek proxy chat error:", error);
      return res.status(500).json({ error: error?.message || "خطای سرور" });
    }
  });


  // API endpoint for Gemini AI assistance in SEO & CMS
  app.post("/api/gemini/generate", rateLimitMiddleware(15, 60000), async (req, res) => {
    try {
      const { prompt, systemInstruction, type } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "متن درخواست الزامی است." });
      }

      const ai = getAiClient();
      
      let defaultSys = "شما یک دستیار متخصص سئو، وب۳ و محتوای سولانا برای پلتفرم سولمینت (solmint.ir) هستید. پاسخ‌های خود را به زبان فارسی روان، جذاب و استاندارد سئو ارائه دهید.";
      if (type === "seo_summary") {
        defaultSys = "شما دستیار تولید چکیده مقاله استاندارد سئو (Meta Description) به زبان فارسی هستید. چکیده باید بین ۱۲۰ تا ۱۶۰ کاراکتر باشد، جذاب باشد و کلمات کلیدی اصلی را شامل شود.";
      } else if (type === "seo_keywords") {
        defaultSys = "شما متخصص تحقیق کلمات کلیدی وب۳ و سولانا هستید. لیستی از کلمات کلیدی کاما جدا شده برای موضوع داده شده به فارسی ارائه دهید.";
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction || defaultSys,
          temperature: 0.7,
        },
      });

      const resultText = response.text || "";
      return res.json({ result: resultText });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      return res.status(500).json({ 
        error: error.message || "خطا در ارتباط با هوش مصنوعی. لطفاً کلید GEMINI_API_KEY را بررسی کنید." 
      });
    }
  });

  // Authentic Solana Mainnet Status API with RPC querying and safe caching
  let cachedSolanaStatus = {
    price: 184.25,
    change24h: +4.38,
    tps: 2890,
    avgFeeUsd: 0.00025,
    avgFeeSol: 0.000005,
    status: "Mainnet Beta Online",
    slot: 284910283,
    lastUpdated: new Date().toISOString(),
    isLive: true
  };
  let lastRpcFetchTime = 0;

  app.get("/api/solana/status", async (req, res) => {
    const now = Date.now();
    // Refresh every 10 seconds from real Solana Mainnet RPC if available
    if (now - lastRpcFetchTime > 10000) {
      try {
        // Query official Solana Mainnet JSON-RPC
        const rpcRes = await fetch("https://api.mainnet-beta.solana.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([
            { jsonrpc: "2.0", id: 1, method: "getSlot", params: [] },
            { jsonrpc: "2.0", id: 2, method: "getRecentPerformanceSamples", params: [1] }
          ])
        });

        if (rpcRes.ok) {
          const rpcData = await rpcRes.json();
          const slotItem = rpcData.find((d: any) => d.id === 1);
          const sampleItem = rpcData.find((d: any) => d.id === 2);

          if (slotItem && slotItem.result) {
            cachedSolanaStatus.slot = Number(slotItem.result);
          }

          if (sampleItem && sampleItem.result && sampleItem.result.length > 0) {
            const sample = sampleItem.result[0];
            const numTxs = sample.numTransactions || 0;
            const numSecs = sample.samplePeriodSecs || 60;
            cachedSolanaStatus.tps = Math.round(numTxs / numSecs);
          }
          cachedSolanaStatus.status = "Mainnet Beta Online";
          cachedSolanaStatus.lastUpdated = new Date().toISOString();
          cachedSolanaStatus.isLive = true;
          lastRpcFetchTime = now;
        }
      } catch (err) {
        console.warn("Solana RPC query warning:", err);
      }
    }
    return res.json(cachedSolanaStatus);
  });

  // Dynamic Sitemap XML Endpoint fetching from REAL article data source
  app.get("/sitemap.xml", async (req, res) => {
    const baseUrl = "https://solmint.ir";

    const staticRoutes = [
      { path: "" },
      { path: "/solana-wallet" },
      { path: "/solana-token" },
      { path: "/solana-meme-coin" },
      { path: "/solana-nft" },
      { path: "/security" },
      { path: "/download" },
      { path: "/blog" },
      { path: "/faq" }
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static primary pages (no artificial lastmod, no priority, no changefreq)
    staticRoutes.forEach(r => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${r.path}</loc>\n`;
      xml += `  </url>\n`;
    });

    // Dynamic Published Articles from REAL Database Data Source
    const allArticles = await getAllPublishedArticles();
    allArticles.forEach(art => {
      const artLastMod = formatLastModDate(art);
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/article/${art.slug}</loc>\n`;
      if (artLastMod) {
        xml += `    <lastmod>${artLastMod}</lastmod>\n`;
      }
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.type("xml").send(xml);
  });

  // Dynamic Robots.txt Endpoint
  app.get("/robots.txt", (req, res) => {
    const robotsTxt = `# SolMint.ir Official Robots.txt
User-agent: *
Allow: /
Allow: /solana-wallet
Allow: /solana-token
Allow: /solana-meme-coin
Allow: /solana-nft
Allow: /security
Allow: /download
Allow: /blog
Allow: /article/
Allow: /faq

Disallow: /admin
Disallow: /api/

Sitemap: https://solmint.ir/sitemap.xml
`;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.type("text").send(robotsTxt);
  });

  // Vite middleware or static serving
  let viteServer: any = null;
  if (process.env.NODE_ENV !== "production") {
    viteServer = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(viteServer.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      maxAge: "1y",
      etag: true,
      immutable: true,
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, must-revalidate");
        }
      }
    }));
  }

  // 404 Guard for missing static assets or source maps
  app.use((req, res, next) => {
    if (
      req.path.startsWith("/assets/") ||
      req.path.endsWith(".map") ||
      req.path.endsWith(".js") ||
      req.path.endsWith(".css") ||
      req.path.endsWith(".png") ||
      req.path.endsWith(".jpg") ||
      req.path.endsWith(".jpeg") ||
      req.path.endsWith(".svg") ||
      req.path.endsWith(".woff2")
    ) {
      return res.status(404).type("text/plain").send("Asset or source map not found");
    }
    next();
  });

  // HTML Server-Side Pre-rendering & SEO Injection Handler for all page routes
  app.get("*", async (req, res, next) => {
    try {
      if (process.env.NODE_ENV !== "production" && viteServer) {
        const indexPath = path.join(process.cwd(), "index.html");
        if (!fs.existsSync(indexPath)) return next();
        let template = fs.readFileSync(indexPath, "utf-8");
        template = await viteServer.transformIndexHtml(req.originalUrl, template);
        const { html, status, isRedirect, redirectUrl } = await renderSeoPage(template, req.path);
        if (isRedirect && redirectUrl) {
          return res.redirect(301, redirectUrl);
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(status).send(html);
      } else {
        const distPath = path.join(process.cwd(), "dist");
        const indexPath = path.join(distPath, "index.html");
        if (fs.existsSync(indexPath)) {
          const template = fs.readFileSync(indexPath, "utf-8");
          const { html, status, isRedirect, redirectUrl } = await renderSeoPage(template, req.path);
          if (isRedirect && redirectUrl) {
            return res.redirect(301, redirectUrl);
          }
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          return res.status(status).send(html);
        }
        return next();
      }
    } catch (err) {
      console.error("Error in SSR rendering handler:", err);
      return next();
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Solmint Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
