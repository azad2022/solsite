const BASE_URL = 'https://solmint.ir';

type PageItem = {
  path: string;
};

const CORE_PAGES: PageItem[] = [
  { path: '' },
  { path: '/solana-wallet' },
  { path: '/solana-token' },
  { path: '/solana-meme-coin' },
  { path: '/solana-nft' },
  { path: '/solana-price' },
  { path: '/wallet-analyzer' },
  { path: '/tools/solana-token-tools' },
  { path: '/tools/solana-token-scanner' },
  { path: '/tools/token-2022-inspector' },
  { path: '/blog' },
  { path: '/app-guide' },
  { path: '/security' },
  { path: '/download' },
  { path: '/faq' }
];

export const onRequestGet = async () => {
  // Do not emit a fabricated daily <lastmod>. Google uses sitemap lastmod as a
  // crawl-scheduling signal only when it is consistently and verifiably accurate.
  // These aggregate/core pages do not currently have a reliable per-page
  // significant-update timestamp, so omitting lastmod is more correct.
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const page of CORE_PAGES) {
    const url = `${BASE_URL}${page.path}`;
    xml += `  <url>\n`;
    xml += `    <loc>${url}</loc>\n`;
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
