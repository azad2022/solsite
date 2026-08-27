type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type PageContext = {
  request: Request;
  next: () => Promise<Response>;
  env?: Env;
};

type KrakenTicker = {
  result?: Record<string, { c?: string[]; o?: string[]; p?: string[]; h?: string[]; l?: string[]; v?: string[] }>;
};

const SITE_URL = 'https://solmint.ir';
const PAGE_URL = `${SITE_URL}/solana-price`;
const TITLE = 'قیمت سولانا امروز؛ نرخ لحظه‌ای سولانا و تحلیل بازار solana';
const DESCRIPTION = 'قیمت سولانا امروز و نرخ لحظه‌ای سولانا (SOL/USD)، نمودار زنده، تغییرات ۲۴ ساعت، حجم معاملات و تحلیل تکنیکال سولانا را با داده به‌روز بازار در سولمینت بررسی کنید.';
const KRAKEN_TICKER_URL = 'https://api.kraken.com/0/public/Ticker?pair=SOLUSD';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function setTitle(html: string, title: string): string {
  const tag = `<title>${escapeHtml(title)}</title>`;
  return /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/i, tag)
    : html.replace('</head>', `  ${tag}\n</head>`);
}

function setMeta(html: string, name: string, content: string): string {
  const tag = `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}">`;
  const rx = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, 'i');
  return rx.test(html) ? html.replace(rx, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

function setProperty(html: string, property: string, content: string): string {
  const tag = `<meta property="${escapeHtml(property)}" content="${escapeHtml(content)}">`;
  const rx = new RegExp(`<meta\\s+property=["']${property}["'][^>]*>`, 'i');
  return rx.test(html) ? html.replace(rx, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

function setCanonical(html: string): string {
  const tag = `<link rel="canonical" href="${PAGE_URL}">`;
  const rx = /<link\s+rel=["']canonical["'][^>]*>/i;
  return rx.test(html) ? html.replace(rx, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

function setJsonLd(html: string, value: unknown): string {
  const tag = `<script id="solmint-solana-price-jsonld" type="application/ld+json">${escapeJsonLd(value)}</script>`;
  const rx = /<script[^>]*id=["']solmint-solana-price-jsonld["'][^>]*>[\s\S]*?<\/script>/i;
  return rx.test(html) ? html.replace(rx, tag) : html.replace('</head>', `  ${tag}\n</head>`);
}

async function fetchTicker(): Promise<{ price: number; change24h: number } | null> {
  try {
    const response = await fetch(KRAKEN_TICKER_URL, {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 30, cacheEverything: true },
    } as RequestInit & { cf?: { cacheTtl: number; cacheEverything: boolean } });
    if (!response.ok) return null;
    const payload = await response.json() as KrakenTicker;
    const key = Object.keys(payload.result || {})[0];
    const row = key ? payload.result?.[key] : undefined;
    const price = Number(row?.c?.[0]);
    const open24h = Number(row?.o?.[0]);
    if (!Number.isFinite(price)) return null;
    const change24h = Number.isFinite(open24h) && open24h !== 0 ? ((price / open24h) - 1) * 100 : 0;
    return { price, change24h };
  } catch {
    return null;
  }
}

function buildIntro(market: { price: number; change24h: number } | null): string {
  const marketText = market
    ? `قیمت فعلی SOL/USD حدود ${market.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} دلار است و تغییر ۲۴ ساعت اخیر ${market.change24h >= 0 ? '+' : ''}${market.change24h.toFixed(2)} درصد ثبت شده است.`
    : 'داده بازار در مرورگر به‌صورت زنده دریافت و به‌روزرسانی می‌شود.';
  return `این صفحه مرجع زنده قیمت سولانا، نرخ لحظه‌ای SOL و تحلیل بازار سولانا در سولمینت است. ${marketText} نمودار کندلی، حجم معاملات، تایم‌فریم‌های کوتاه و بلند و شاخص‌های تکنیکال برای بررسی وضعیت بازار در همین صفحه در دسترس هستند.`;
}

function buildSeoShell(market: { price: number; change24h: number } | null): string {
  const updatedAt = new Date().toISOString();
  const intro = buildIntro(market);
  const priceBlock = market
    ? `<div class="solmint-price-ssr-card"><strong>${escapeHtml(market.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))} USD</strong><span>تغییر ۲۴ ساعت: ${escapeHtml(`${market.change24h >= 0 ? '+' : ''}${market.change24h.toFixed(2)}%`)}</span></div>`
    : '';
  return `<div id="solmint-solana-price-ssr" dir="rtl" lang="fa" data-updated-at="${escapeHtml(updatedAt)}">
  <nav aria-label="مسیر صفحه"><a href="/">خانه</a> / <span aria-current="page">قیمت سولانا</span></nav>
  <main>
    <header>
      <h1>قیمت سولانا امروز؛ نرخ لحظه‌ای SOL و تحلیل بازار</h1>
      <p>${escapeHtml(intro)}</p>
      ${priceBlock}
      <p><time datetime="${escapeHtml(updatedAt)}">آخرین بروزرسانی داده مرجع: ${escapeHtml(new Date(updatedAt).toLocaleString('fa-IR'))}</time> · منبع داده بازار: Kraken · جفت معاملاتی: SOL/USD</p>
    </header>
    <section aria-labelledby="solana-price-overview"><h2 id="solana-price-overview">قیمت لحظه‌ای سولانا و نمودار زنده SOL/USD</h2><p>برای بررسی قیمت سولانا، روند کوتاه‌مدت و تغییرات بازار می‌توانید نمودار زنده را در تایم‌فریم‌های ۱ دقیقه، ۵ دقیقه، ۱۵ دقیقه، ۱ ساعت، ۴ ساعت و روزانه مشاهده کنید.</p></section>
    <section aria-labelledby="solana-analysis-today"><h2 id="solana-analysis-today">تحلیل سولانا امروز</h2><p>تحلیل بازار سولانا بر پایه قیمت و داده‌های OHLC انجام می‌شود و شاخص‌هایی مانند EMA، RSI، MACD، ATR، Bollinger Bands، Stochastic، ADX، حجم و سطوح حمایت و مقاومت را بررسی می‌کند. این تحلیل ابزار اطلاعاتی است و توصیه خرید یا فروش نیست.</p></section>
    <section aria-labelledby="solana-market-data"><h2 id="solana-market-data">داده‌های بازار سولانا</h2><p>در این صفحه علاوه بر نرخ لحظه‌ای، تغییرات ۲۴ ساعت، حجم معاملات، روند بازار و اطلاعات تکنیکال SOL/USD ارائه می‌شود. داده‌های بازار از Kraken دریافت می‌شوند و نمایش زنده در رابط کاربری به‌صورت دوره‌ای به‌روزرسانی می‌شود.</p></section>
    <section aria-labelledby="solana-faq"><h2 id="solana-faq">سوالات متداول درباره قیمت سولانا</h2><h3>قیمت سولانا امروز چگونه تعیین می‌شود؟</h3><p>قیمت نمایش‌داده‌شده بر اساس داده بازار SOL/USD است و با دریافت داده جدید به‌روزرسانی می‌شود.</p><h3>نرخ لحظه‌ای سولانا هر چند وقت به‌روزرسانی می‌شود؟</h3><p>رابط زنده بازار داده‌ها را به‌صورت دوره‌ای تازه‌سازی می‌کند و زمان آخرین بروزرسانی نیز در صفحه نمایش داده می‌شود.</p><h3>آیا این صفحه تحلیل سولانا امروز را هم ارائه می‌کند؟</h3><p>بله. وضعیت تکنیکال SOL با چند شاخص رایج بازار محاسبه و همراه با نمودار و سطوح کلیدی نمایش داده می‌شود.</p></section>
  </main>
</div>`;
}

function buildJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${PAGE_URL}#webpage`,
        url: PAGE_URL,
        name: TITLE,
        description: DESCRIPTION,
        inLanguage: 'fa-IR',
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website`, url: SITE_URL, name: 'سولمینت' },
        about: { '@type': 'Thing', name: 'Solana (SOL)', sameAs: 'https://solana.com/' },
        breadcrumb: { '@id': `${PAGE_URL}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${PAGE_URL}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'خانه', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'قیمت سولانا', item: PAGE_URL },
        ],
      },
    ],
  };
}

export const onRequest = async (context: PageContext): Promise<Response> => {
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=UTF-8');
  headers.set('X-Robots-Tag', 'index, follow');
  headers.set('X-Solmint-SEO', 'solana-price-ssr-v3');
  headers.set('Cache-Control', 'public, max-age=30, s-maxage=30, stale-while-revalidate=120');

  if (!response.ok) return new Response(response.body, { status: response.status, headers });

  let html = await response.text();
  const market = await fetchTicker();
  html = setTitle(html, TITLE);
  html = setMeta(html, 'description', DESCRIPTION);
  html = setMeta(html, 'robots', 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1');
  html = setMeta(html, 'author', 'سولمینت');
  html = setMeta(html, 'twitter:card', 'summary_large_image');
  html = setMeta(html, 'twitter:title', TITLE);
  html = setMeta(html, 'twitter:description', DESCRIPTION);
  html = setMeta(html, 'twitter:image', `${SITE_URL}/images/solmint-banner.jpg`);
  html = setProperty(html, 'og:title', TITLE);
  html = setProperty(html, 'og:description', DESCRIPTION);
  html = setProperty(html, 'og:url', PAGE_URL);
  html = setProperty(html, 'og:type', 'website');
  html = setProperty(html, 'og:site_name', 'سولمینت');
  html = setProperty(html, 'og:locale', 'fa_IR');
  html = setProperty(html, 'og:image', `${SITE_URL}/images/solmint-banner.jpg`);
  html = setProperty(html, 'og:image:alt', 'قیمت لحظه‌ای سولانا و نمودار زنده SOL/USD');
  html = setCanonical(html);
  html = setJsonLd(html, buildJsonLd());

  const shell = buildSeoShell(market);
  if (/<div id="root"><\/div>/i.test(html)) {
    html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${shell}</div>`);
  } else if (!html.includes('id="solmint-solana-price-ssr"')) {
    html = html.replace(/<body([^>]*)>/i, `<body$1>${shell}`);
  }

  return new Response(html, { status: response.status, headers });
};
