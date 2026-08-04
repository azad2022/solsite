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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

async function generate() {
  console.log("⚡ Generating production sitemap.xml and robots.txt...");

  const staticRoutes = [
    "",
    "/solana-wallet",
    "/solana-token",
    "/solana-meme-coin",
    "/solana-nft",
    "/security",
    "/download",
    "/blog",
    "/faq"
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
      if (Array.isArray(data)) {
        articles = data;
      }
    } else {
      console.warn("⚠️ Could not fetch articles from Supabase REST API during sitemap generation:", res.statusText);
    }
  } catch (err) {
    console.warn("⚠️ Exception fetching articles for sitemap generation:", err);
  }

  // 1. Generate sitemap.xml
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

    const rawDate = art.published_at_gregorian || art.publishedAtGregorian || art.created_at || art.createdAt;
    const lastMod = formatDate(rawDate);

    xml += `  <url>\n`;
    xml += `    <loc>${BASE_URL}/article/${xmlEscape(cleanSlug)}</loc>\n`;
    if (lastMod) {
      xml += `    <lastmod>${lastMod}</lastmod>\n`;
    }
    xml += `  </url>\n`;
  });

  xml += `</urlset>`;

  // 2. Generate robots.txt
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

  // Write to public/ directory
  const publicDir = path.join(process.cwd(), "public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(path.join(publicDir, "sitemap.xml"), xml, "utf-8");
  fs.writeFileSync(path.join(publicDir, "robots.txt"), robotsTxt, "utf-8");

  // Write to dist/ directory if it exists
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
