type PageContext = { request: Request; next: () => Promise<Response> };

const SEO = {
  title: 'راهنمای کامل اپلیکیشن سولمینت | آموزش کیف پول، توکن، NFT و Swap',
  description: 'راهنمای جامع استفاده از اپلیکیشن اندروید سولمینت؛ آموزش مرحله‌به‌مرحله کیف پول سولانا، ساخت توکن، Meme Coin، NFT، Swap، بازیابی Rent و نقدینگی.',
  canonical: 'https://solmint.ir/app-guide'
};

const body = `<main id="seo-static-content" dir="rtl" lang="fa"><article><nav aria-label="مسیر صفحه"><a href="/">سولمینت</a> / <span>راهنمای اپلیکیشن</span></nav><h1>راهنمای کامل و جامع استفاده از اپلیکیشن سولمینت</h1><p>در این راهنما به بررسی تک‌تک بخش‌ها و قابلیت‌های کاربردی اپلیکیشن سولمینت می‌پردازیم تا بتوانید با بالاترین سطح امنیت و کارایی از امکانات اکوسیستم وب۳ سولانا بهره‌مند شوید.</p><h2>آموزش ساخت و بازیابی کیف پول</h2><p>پس از نصب برنامه، یک عبارت بازیابی ۱۲ یا ۲۴ کلمه‌ای به شما نمایش داده می‌شود. این کلمات کلید دسترسی به تمام دارایی‌های شما هستند و باید روی کاغذ در مکانی امن یادداشت شوند.</p><h2>آموزش ساخت توکن و میم کوین</h2><p>وارد بخش ساخت توکن شوید، نام، نماد و مشخصات دلخواه را وارد کرده و پس از واریز کارمزد اندک شبکه سولانا، توکن اختصاصی شما در کمتر از ۲ دقیقه ضرب می‌شود.</p><h2>آموزش بازیابی کارمزد اجاره حساب (Rent Refund)</h2><p>از منوی ابزارها، گزینه بازیابی Rent را انتخاب کرده و اجازه دهید کیف پول به صورت خودکار حساب‌های خالی توکن را شناسایی و کارمزد آنها را به کیف پول شما بازگرداند.</p></article></main>`;

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
