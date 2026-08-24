type PageContext = { request: Request; next: () => Promise<Response> };

const SEO = {
  title: 'ساخت میم کوین سولانا | ساخت ارز دیجیتال میم بدون کدنویسی - سولمینت',
  description: 'آموزش و ابزار ساخت میم کوین در شبکه سولانا بدون نیاز به دانش برنامه‌نویسی. ساخت توکن، تعیین ساپلای، سلب دسترسی Mint و ساخت استخر نقدینگی در سولمینت.',
  canonical: 'https://solmint.ir/solana-meme-coin'
};

const body = `<main id="seo-static-content" dir="rtl" lang="fa"><article><nav aria-label="مسیر صفحه"><a href="/">سولمینت</a> / <span>ساخت میم کوین سولانا</span></nav><h1>راهنمای جامع ساخت میم کوین در شبکه سولانا</h1><p>میم کوین‌ها بخش پر جنب‌وجوشی از اکوسیستم کریپتو هستند. شبکه سولانا به دلیل کارمزد بسیار پایین و سرعت بالای پردازش تراکنش‌ها، به قطب اصلی راه‌اندازی میم کوین‌ها در جهان تبدیل شده است.</p><h2>مراحل ساخت میم کوین در سولمینت</h2><p>با اپلیکیشن غیرامانی سولمینت بدون نیاز به نوشتن حتی یک خط کد، می‌توانید میم کوین اختصاصی خود را بر بستر استاندارد SPL بسازید. کافیست نام، نماد (Ticker)، تصویر لوگو و تعداد کل توکن‌ها را مشخص کنید.</p><h2>سلب اختیارات مدیریتی (Revoke Mint & Freeze Authority)</h2><p>یکی از معیارهای اصلی جلب اعتماد خریداران در میم کوین‌ها، سلب دسترسی سازنده به ضرب مجدد توکن (Revoke Mint Authority) و مسدودسازی حساب‌ها (Revoke Freeze Authority) است. سولمینت این قابلیت‌ها را تنها با یک کلیک در اختیار شما قرار می‌دهد.</p><h2>ایجاد استخر نقدینگی (Liquidity Pool)</h2><p>پس از ساخت توکن، برای قابل معامله شدن آن در صرافی‌های غیرمتمرکز نظیر Raydium، می‌توانید مستقیماً از داخل اپلیکیشن استخر نقدینگی جدید ایجاد کنید.</p></article></main>`;

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
