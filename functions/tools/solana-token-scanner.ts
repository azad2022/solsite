type PageContext = { request: Request; next: () => Promise<Response> };

const SEO = {
  title: 'اسکنر توکن سولانا | بررسی امنیت، ریسک و قراردادهای هوشمند - سولمینت',
  description: 'ابزار رایگان اسکن توکن‌های شبکه سولانا. شناسایی ریسک‌های امنیتی، استخرهای نقدینگی، مجوزهای Mint و Freeze و هشدارهای کلاهبرداری قبل از خرید.',
  canonical: 'https://solmint.ir/tools/solana-token-scanner'
};

const body = `<main id="seo-static-content" dir="rtl" lang="fa"><article><nav aria-label="مسیر صفحه"><a href="/">سولمینت</a> / <span>اسکنر توکن سولانا</span></nav><h1>اسکنر و تحلیلگر امنیت توکن‌های سولانا</h1><p>پیش از سرمایه‌گذاری یا خرید هر توکن در شبکه سولانا، با وارد کردن آدرس قرارداد (Mint Address) وضعیت امنیتی آن را به صورت زنده و آنچین ارزیابی کنید.</p><h2>چه مواردی اسکن می‌شوند؟</h2><ul><li>وضعیت قفل بودن یا سلب دسترسی Mint Authority</li><li>بررسی Freeze Authority برای جلوگیری از بلوکه شدن دارایی‌ها</li><li>وضعیت استخر نقدینگی و سوزانده شدن توکن‌های LP</li><li>توزیع دارایی میان هولدرهای اصلی و نهنگ‌ها</li></ul></article></main>`;

function inject(html: string): string {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${SEO.title}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${SEO.description}">`)
    .replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${SEO.canonical}">`)
    .replace(/<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">`)
    .replace(/<div id="root"><\/div>/i, `<div id="root">${body}</div>`);
}

export async function onRequest(context: PageContext): Promise<Response> {
  const origin = await context.next();
  const headers = new Headers(origin.headers);
  headers.set('Content-Type', 'text/html; charset=UTF-8');
  headers.set('X-Robots-Tag', 'index, follow');
  headers.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  return new Response(inject(await origin.text()), { status: 200, headers });
}
