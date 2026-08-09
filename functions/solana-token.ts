type PageContext = { request: Request; next: () => Promise<Response> };

const SEO = {
  title: 'ساخت توکن سولانا (SPL Token) | راهنمای کامل و ابزار سولمینت',
  description: 'راهنمای تخصصی ساخت توکن سولانا با استاندارد SPL؛ بررسی نام، نماد، عرضه، اعشار، Metadata، Mint و نکات امنیتی بدون نیاز به کدنویسی.',
  canonical: 'https://solmint.ir/solana-token'
};

const body = `<main id="seo-static-content" dir="rtl" lang="fa"><article><nav aria-label="مسیر صفحه"><a href="/">سولمینت</a> / <span>ساخت توکن سولانا</span></nav><h1>ساخت توکن سولانا (SPL Token)؛ راهنمای کامل ایجاد و مدیریت</h1><p>ساخت توکن در شبکه سولانا به معنی ایجاد یک دارایی دیجیتال بر پایه زیرساخت توکن این شبکه است. در این فرآیند، مشخصات اصلی دارایی، حساب Mint و اطلاعات مربوط به Metadata ایجاد می‌شوند و مالک می‌تواند توکن را در کیف پول خود مدیریت کند. برخلاف ساخت یک بلاکچین مستقل، ایجاد SPL Token به طراحی و نگهداری شبکه جداگانه نیاز ندارد.</p><h2>توکن SPL چیست؟</h2><p>توکن‌های سولانا از استانداردهای بومی اکوسیستم Solana استفاده می‌کنند. یک Token Mint اطلاعات مهمی مانند عرضه، تعداد اعشار و برخی Authorityهای مرتبط را مشخص می‌کند. موجودی هر کاربر نیز در حساب مربوط به دارایی نگهداری می‌شود. بنابراین ساخت توکن فقط تولید یک نام و لوگو نیست؛ تنظیمات فنی آن باید با کاربرد واقعی پروژه هماهنگ باشد.</p><h2>قبل از ساخت توکن چه چیزهایی باید مشخص شود؟</h2><h3>نام و نماد</h3><p>نام و Symbol باید کوتاه، قابل تشخیص و منطبق با هویت پروژه باشند. تغییرات نام‌گذاری پس از انتشار می‌تواند باعث سردرگمی کاربران شود.</p><h3>Supply و Decimals</h3><p>عرضه کل و تعداد اعشار باید پیش از ایجاد Token مشخص شود. Decimals نحوه نمایش کوچک‌ترین واحد دارایی را تعیین می‌کند و Supply باید با مدل توزیع و اقتصاد پروژه سازگار باشد.</p><h2>Metadata چه نقشی دارد؟</h2><p>لوگو، نام نمایشی، توضیحات و سایر اطلاعات قابل مشاهده معمولاً از Metadata خوانده می‌شوند. بنابراین باید از منبع پایدار و قابل اعتماد برای Metadata استفاده شود. وجود یک لوگو به تنهایی نشانه معتبر بودن یک توکن نیست و کاربران باید آدرس Mint را نیز بررسی کنند.</p><h2>مراحل ساخت توکن سولانا</h2><ol><li>اتصال کیف پول غیرامانی و اطمینان از داشتن مقدار کافی SOL برای هزینه شبکه.</li><li>تعیین نام، Symbol، Supply و Decimals.</li><li>ایجاد Mint و ثبت اطلاعات مورد نیاز.</li><li>امضای تراکنش توسط صاحب کیف پول؛ کلید خصوصی نباید در اختیار سرویس قرار گیرد.</li><li>بررسی آدرس Mint و اطلاعات توکن در Explorer.</li></ol><h2>بعد از ساخت توکن چه اتفاقی می‌افتد؟</h2><p>ایجاد Token به‌تنهایی بازار، قیمت یا نقدینگی ایجاد نمی‌کند. اگر پروژه به دنبال معامله عمومی است، باید توزیع توکن، نقدینگی، جفت معاملاتی، مدیریت Authorityها و سیاست‌های امنیتی را جداگانه طراحی کند. همچنین باید مشخص باشد چه کسی اختیار Mint یا Freeze را در اختیار دارد و آیا این اختیارات بعداً محدود یا لغو می‌شوند.</p><h2>امنیت هنگام ساخت توکن</h2><p>هر سرویسی که برای ساخت Token از کاربر Seed Phrase یا Private Key بخواهد، باید با حساسیت بسیار بالا بررسی شود. ساخت حرفه‌ای باید به گونه‌ای باشد که تراکنش در کیف پول کاربر ساخته و امضا شود. کاربر همچنین باید آدرس مقصد و جزئیات تراکنش را پیش از تأیید کنترل کند.</p><h2>چرا سولمینت؟</h2><p>سولمینت فرآیند ساخت توکن را برای کاربران اندروید ساده می‌کند و هدف آن کاهش نیاز به دانش برنامه‌نویسی است. با این حال، ابزار ساخت جایگزین تصمیم‌گیری اقتصادی، بررسی امنیتی و تحقیق درباره بازار نمی‌شود.</p><p>برای مطالعه بیشتر، <a href="/solana-wallet">راهنمای کیف پول سولانا</a>، <a href="/solana-nft">راهنمای NFT سولانا</a> و <a href="/faq">سوالات متداول سولمینت</a> را ببینید.</p></article></main>`;

function inject(html: string): string {
  const meta = `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">`;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${SEO.title}</title>`);
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${SEO.description}">`);
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${SEO.canonical}">`);
  html = html.replace(/<meta\s+name=["']robots["'][^>]*>/i, meta);
  html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${body}</div>`);
  return html;
}

export async function onRequest(context: PageContext): Promise<Response> {
  const origin = await context.next();
  let html = await origin.text();
  html = inject(html);
  const headers = new Headers(origin.headers);
  headers.set('Content-Type', 'text/html; charset=UTF-8');
  headers.set('X-Robots-Tag', 'index, follow');
  headers.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  return new Response(html, { status: 200, headers });
}
