const BASE_URL = 'https://solmint.ir';

type PageItem = {
  path: string;
  priority: string;
  changefreq: string;
};

const CORE_PAGES: PageItem[] = [
  { path: '', priority: '1.0', changefreq: 'daily' },
  { path: '/solana-wallet', priority: '0.9', changefreq: 'weekly' },
  { path: '/solana-token', priority: '0.9', changefreq: 'weekly' },
  { path: '/solana-meme-coin', priority: '0.9', changefreq: 'weekly' },
  { path: '/solana-nft', priority: '0.8', changefreq: 'weekly' },
  { path: '/solana-price', priority: '0.9', changefreq: 'hourly' },
  { path: '/wallet-analyzer', priority: '0.8', changefreq: 'weekly' },
  { path: '/tools/solana-token-tools', priority: '0.8', changefreq: 'weekly' },
  { path: '/tools/solana-token-scanner', priority: '0.8', changefreq: 'weekly' },
  { path: '/tools/token-2022-inspector', priority: '0.8', changefreq: 'weekly' },
  { path: '/blog', priority: '0.8', changefreq: 'daily' },
  { path: '/app-guide', priority: '0.8', changefreq: 'weekly' },
  { path: '/security', priority: '0.7', changefreq: 'monthly' },
  { path: '/download', priority: '0.8', changefreq: 'weekly' },
  { path: '/faq', priority: '0.7', changefreq: 'weekly' }
];

export const onRequestGet = async () => {
  const today = new Date().toISOString().split('T')[0];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const page of CORE_PAGES) {
    const url = `${BASE_URL}${page.path}`;
    xml += `  <url>\n`;
    xml += `    <loc>${url}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += '</urlset>\n';

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
};
