type PageContext = { request: Request; next: () => Promise<Response> };

const SEO = {
  title: 'معماری امنیتی و غیرامانی سولمینت | حفظ کلیدهای خصوصی',
  description: 'تشریح کامل معماری امنیتی غیرامانی سولمینت. ذخیره‌سازی محلی کلیدهای خصوصی و عبارت‌های بازیابی، امضای آفلاین تراکنش‌ها و عدم دسترسی سرور به دارایی‌ها.',
  canonical: 'https://solmint.ir/security'
};

const body = `<main id="seo-static-content" dir="rtl" lang="fa"><article><nav aria-label="مسیر صفحه"><a href="/">سولمینت</a> / <span>معماری امنیتی</span></nav><h1>معماری امنیتی و مدل غیرامانی اپلیکیشن سولمینت</h1><p>امنیت در اکوسیستم وب۳ با کنترل مستقیم کلیدهای خصوصی توسط کاربر معنا پیدا می‌کند. سولمینت بر پایه معماری کاملاً غیرامانی (Non-Custodial) طراحی شده است.</p><h2>رمزنگاری سخت‌افزاری محلی</h2><p>تمام عبارات بازیابی (Seed Phrase) و کلیدهای خصوصی با الگوریتم رمزنگاری AES-256 در Keystore امن سیستم‌عامل اندروید ذخیره می‌شوند و هرگز به سرورهای خارجی ارسال نخواهند شد.</p><h2>امضای تراکنش‌ها در دستگاه کاربر</h2><p>تمامی تعاملات بلاک‌چین، ایجاد توکن، سواپ و ضرب NFT ابتدا در داخل دستگاه کاربر ساخته، بازبینی و امضا شده و سپس مستقیماً به نودهای RPC شبکه سولانا ارسال می‌شوند.</p></article></main>`;

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
