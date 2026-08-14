import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://nvopkbiedorfshwbmyhn.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_XaeRMCeIhR7-Zwq6YhdkVw_cOwO9OLt";
const BASE_URL = "https://solmint.ir";

function xmlEscape(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fa-IR")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function addTaxonomy(taxonomyMap, type, name) {
  const cleanName = String(name || "").trim();
  const slug = slugify(cleanName);
  if (!cleanName || !slug) return;
  const key = `${type}:${slug}`;
  const current = taxonomyMap.get(key) || { type, name: cleanName, slug, count: 0 };
  current.count += 1;
  taxonomyMap.set(key, current);
}

async function generate() {
  console.log("⚡ Generating production sitemap.xml and robots.txt...");

  const staticRoutes = [
    "",
    "/solana-wallet",
    "/solana-token",
    "/solana-meme-coin",
    "/solana-nft",
    "/app-guide",
    "/security",
    "/download",
    "/blog",
    "/faq",
    "/tools/solana-token-tools",
    "/tools/solana-token-scanner",
    "/tools/token-2022-inspector"
  ];

  let articles = [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/articles?select=*`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) articles = data;
    } else {
      console.warn("⚠️ Could not fetch articles from Supabase REST API during sitemap generation:", res.statusText);
    }
  } catch (err) {
    console.warn("⚠️ Exception fetching articles for sitemap generation:", err);
  }

  const taxonomyMap = new Map();
  articles.forEach(art => {
    if (art.is_draft || art.isDraft) return;
    addTaxonomy(taxonomyMap, "category", art.category);
    const tags = Array.isArray(art.tags) ? art.tags : [];
    tags.forEach(tag => addTaxonomy(taxonomyMap, "tag", tag));
  });

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  staticRoutes.forEach(r => {
    xml += `  <url>\n`;
    xml += `    <loc>${BASE_URL}${r}</loc>\n`;
    xml += `  </url>\n`;
  });

  articles.forEach(art => {
    if (art.is_draft || art.isDraft) return;
    const cleanSlug = (art.slug || "").trim().replace(/^\/+|\/+$/g, "");
    if (!cleanSlug) return;
    const rawDate = art.updated_at || art.updatedAt || art.published_at_gregorian || art.publishedAtGregorian || art.created_at || art.createdAt;
    const lastMod = formatDate(rawDate);
    xml += `  <url>\n`;
    xml += `    <loc>${BASE_URL}/article/${xmlEscape(cleanSlug)}</loc>\n`;
    if (lastMod) xml += `    <lastmod>${lastMod}</lastmod>\n`;
    xml += `  </url>\n`;
  });

  // Only publish taxonomy archives with at least two published articles.
  // This prevents thin taxonomy pages from being advertised to crawlers.
  for (const item of taxonomyMap.values()) {
    if (item.count < 2) continue;
    const prefix = item.type === "category" ? "category" : "tag";
    xml += `  <url>\n`;
    xml += `    <loc>${BASE_URL}/blog/${prefix}/${xmlEscape(item.slug)}</loc>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>`;

  const robotsTxt = `# SolMint.ir Official Robots.txt
User-agent: *
Allow: /
Allow: /solana-wallet
Allow: /solana-token
Allow: /solana-meme-coin
Allow: /solana-nft
Allow: /app-guide
Allow: /security
Allow: /download
Allow: /blog
Allow: /article/
Allow: /blog/category/
Allow: /blog/tag/
Allow: /faq
Allow: /tools/

Disallow: /admin
Disallow: /api/

Sitemap: https://solmint.ir/sitemap.xml
`;

  const publicDir = path.join(process.cwd(), "public");
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, "sitemap.xml"), xml, "utf-8");
  fs.writeFileSync(path.join(publicDir, "robots.txt"), robotsTxt, "utf-8");

  const distDir = path.join(process.cwd(), "dist");
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, "sitemap.xml"), xml, "utf-8");
    fs.writeFileSync(path.join(distDir, "robots.txt"), robotsTxt, "utf-8");
  }

  console.log("✅ Successfully generated public/sitemap.xml and public/robots.txt!");
}

generate().catch(err => {
  console.error("❌ Error generating sitemap:", err);
  process.exit(1);
});
