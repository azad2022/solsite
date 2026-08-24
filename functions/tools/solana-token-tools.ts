type PageContext = { request: Request; next: () => Promise<Response> };

const SEO = {
  title: 'مجموعه ابزارهای توکن سولانا | اسکنر، آنالیزور و ابزارهای توسعه - سولمینت',
  description: 'مجموعه ابزارهای حرفه‌ای تحلیل و بررسی توکن در شبکه سولانا، اسکن هوشمند قراردادها، بررسی توکن‌های Token-2022 و آنالیز امنیت دارایی‌های دیجیتال.',
  canonical: 'https://solmint.ir/tools/solana-token-tools'
};

const body = `<main id="seo-static-content" dir="rtl" lang="fa"><article><nav aria-label="مسیر صفحه"><a href="/">سولمینت</a> / <span>ابزارهای توکن سولانا</span></nav><h1>مجموعه ابزارهای تخصصی توکن و دارایی‌های شبکه سولانا</h1><p>سولمینت مجموعه‌ای از ابزارهای آنچین و تحلیلی را برای کاربران، سرمایه‌گذاران و توسعه‌دهندگان اکوسیستم سولانا فراهم کرده است.</p><h2>ابزارهای موجود</h2><ul><li><a href="/tools/solana-token-scanner">اسکنر امنیتی توکن‌های سولانا</a> - بررسی ریسک‌های Rugpull، وضعیت Mint Authority و Freeze Authority.</li><li><a href="/tools/token-2022-inspector">بازرس و تحلیلگر Token-2022</a> - بررسی پیشرفته‌ترین قابلیت‌های استاندارد اکستنشن‌های جدید سولانا.</li><li><a href="/wallet-analyzer">تحلیلگر و آنالیزور کیف پول سولانا</a> - بررسی پورتفولیو، ترنزکشن‌ها و دارایی‌های اکانت‌های سولانا.</li></ul></article></main>`;

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
