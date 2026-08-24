type PageContext = { request: Request; next: () => Promise<Response> };

const SEO = {
  title: 'تحلیلگر توکن ۲۰۲۲ سولانا (Token-2022 Inspector) | سولمینت',
  description: 'ابزار تخصصی بررسی اکستنشن‌های استاندارد Token-2022 در شبکه سولانا شامل کارمزد انتقال (Transfer Fee)، توکن‌های محرمانه و قابلیت‌های پیشرفته.',
  canonical: 'https://solmint.ir/tools/token-2022-inspector'
};

const body = `<main id="seo-static-content" dir="rtl" lang="fa"><article><nav aria-label="مسیر صفحه"><a href="/">سولمینت</a> / <span>بررسی Token-2022</span></nav><h1>بازرس و تحلیلگر اکستنشن‌های Token-2022 سولانا</h1><p>برنامه استاندارد جدید Token-2022 قابلیت‌های پیشرفته‌ای از جمله کارمزدهای انتقال (Transfer Fees)، قفل‌های زمانی و متادیتای تعبیه‌شده را به شبکه سولانا اضافه کرده است.</p><h2>قابلیت‌های ابزار بازرس سولمینت</h2><ul><li>شناسایی خودکار اکستنشن‌های فعال روی قرارداد Token-2022</li><li>محاسبه و نمایش کارمزد انتقال (Transfer Fee) تعیین شده توسط سازنده</li><li>بررسی قابلیت‌های مسدودسازی یا انتقال اجباری (Permanent Delegate)</li></ul></article></main>`;

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
