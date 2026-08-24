import fs from "fs";
import path from "path";

const BASE_URL = "https://solmint.ir";

async function generate() {
  console.log("⚡ Generating production robots.txt (sitemaps are served dynamically by Cloudflare Pages Functions)...");

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

Sitemap: ${BASE_URL}/sitemap.xml
Sitemap: ${BASE_URL}/sitemap-pages.xml
Sitemap: ${BASE_URL}/sitemap-articles.xml
Sitemap: ${BASE_URL}/sitemap-taxonomy.xml
`;

  const publicDir = path.join(process.cwd(), "public");
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  const staticSitemap = path.join(publicDir, "sitemap.xml");
  if (fs.existsSync(staticSitemap)) fs.unlinkSync(staticSitemap);
  fs.writeFileSync(path.join(publicDir, "robots.txt"), robotsTxt, "utf-8");

  const distDir = path.join(process.cwd(), "dist");
  if (fs.existsSync(distDir)) {
    const distSitemap = path.join(distDir, "sitemap.xml");
    if (fs.existsSync(distSitemap)) fs.unlinkSync(distSitemap);
    fs.writeFileSync(path.join(distDir, "robots.txt"), robotsTxt, "utf-8");
  }

  console.log("✅ robots.txt generated; static sitemap disabled to prevent stale Sitemap responses.");
}

generate().catch(err => {
  console.error("❌ Error generating robots.txt:", err);
  process.exit(1);
});
