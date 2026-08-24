type PageContext = { request: Request; next: () => Promise<Response> };

const SEO = {
  title: 'دانلود رسمی اپلیکیشن سولمینت اندروید (SolMint APK)',
  description: 'دانلود مستقیم آخرین نسخه اپلیکیشن اندروید سولمینت. دانلود امن فایل APK با هش تایید شده، راهنمای نصب و به‌روزرسانی اپلیکیشن غیرامانی سولانا.',
  canonical: 'https://solmint.ir/download'
};

const body = `<main id="seo-static-content" dir="rtl" lang="fa"><article><nav aria-label="مسیر صفحه"><a href="/">سولمینت</a> / <span>دانلود اپلیکیشن</span></nav><h1>دانلود مستقیم اپلیکیشن غیرامانی سولمینت برای اندروید</h1><p>اپلیکیشن سولمینت کلیه امکانات ساخت توکن، میم کوین، ضرب NFT، استخر نقدینگی، مدیریت کیف پول غیرامانی و سواپ هوشمند را در قالب یک اپلیکیشن سبک و امن به همراه می‌آورد.</p><h2>ویژگی‌های کلیدی اپلیکیشن سولمینت</h2><ul><li>کیف پول غیرامانی سولانا با امنیت ذخیره‌سازی محلی کلیدهای خصوصی</li><li>ساخت آسان و سریع توکن SPL و راه‌اندازی میم کوین</li><li>پشتیبانی از صرافی‌های غیرمتمرکز و سواپ لحظه‌ای</li><li>ابزار بازپس‌گیری کارمزد اجاره حساب‌های بدون استفاده در شبکه سولانا</li></ul></article></main>`;

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
