import { SITE_DOMAIN } from './seoManager';

type ToolSeoInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
};

const TOOL_SCHEMA_ID = 'solmint-tools-jsonld';
const TOOL_GUIDE_ID = 'solmint-tool-guide';
const MARKET_RISK_ID = 'solmint-market-risk';

function upsertMeta(selector: string, attrs: Record<string, string>, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function upsertJsonLd(payload: unknown) {
  let script = document.head.querySelector<HTMLScriptElement>(`script#${TOOL_SCHEMA_ID}`);
  if (!script) {
    script = document.createElement('script');
    script.id = TOOL_SCHEMA_ID;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
}

function guideData(path: string) {
  if (path === '/tools/solana-token-scanner') {
    return {
      title: 'راهنمای سریع بررسی توکن سولانا',
      intro: 'این راهنما برای کسی است که می‌خواهد بداند نتایج Scanner را چطور بخواند. لازم نیست متخصص بلاکچین باشید؛ از بالا به پایین جلو بروید.',
      items: [
        ['از کجا شروع کنم؟', 'اول Mint Address را از منبع رسمی پروژه یا یک Explorer معتبر بردارید. اسم و نماد توکن کافی نیست، چون توکن‌های مختلف می‌توانند نام مشابه داشته باشند. بعد آدرس Mint را وارد کنید و «بررسی توکن» را بزنید. ابزار فقط داده عمومی شبکه را می‌خواند و تراکنشی ارسال نمی‌کند.'],
        ['Authorityها را چطور تفسیر کنم؟', 'اگر Mint Authority فعال باشد، از نظر فنی امکان افزایش عرضه وجود دارد. اگر Freeze Authority فعال باشد، دارنده آن می‌تواند طبق قوانین Token Program روی وضعیت Token Accountها اثر بگذارد. فعال بودن این مجوزها به‌تنهایی یعنی «اسکم» نیست؛ فقط دو نکته مهم برای بررسی بیشتر هستند.'],
        ['Top 10 و پروفایل فنی چه می‌گویند؟', 'درصد Top 10 سهم ده Token Account بزرگ از عرضه مشاهده‌شده است، نه تعداد کل هولدرها و نه شناسایی قطعی ده نفر. پروفایل فنی هم حکم امنیتی نیست؛ آن را مثل یک چک‌لیست on-chain بخوانید و بعد سراغ نقدشوندگی، قراردادها، تیم پروژه و منابع مستقل بروید.'],
      ],
    };
  }
  if (path === '/tools/token-2022-inspector') {
    return {
      title: 'راهنمای سریع Token-2022 Inspector',
      intro: 'اگر با Token-2022 آشنا نیستید، نگران نباشید. اینجا فقط می‌خواهیم بفهمیم چه قابلیت‌هایی روی Mint فعال شده و هر کدام چه اثری دارند.',
      items: [
        ['Token-2022 چیست؟', 'Token-2022 نسخه‌ای از Token Program سولاناست که قابلیت‌های اضافه‌ای به نام Extension دارد. دیدن Token-2022 به‌خودی‌خود نشانه خوب یا بد بودن پروژه نیست؛ فقط می‌گوید Mint از قابلیت‌های توسعه‌یافته استفاده می‌کند.'],
        ['Transfer Fee و Transfer Hook یعنی چه؟', 'Transfer Fee می‌تواند روی انتقال توکن کارمزد تنظیم کند و Transfer Hook می‌تواند انتقال را به یک برنامه دیگر برای منطق اضافی وصل کند. در چنین مواردی، مقدار تنظیمات و برنامه مرتبط مهم‌تر از خود اسم Extension است.'],
        ['چه چیزی را باید جدی‌تر بررسی کنم؟', 'اول Extensionهای فعال را ببینید، بعد authority و پارامترهای همان Extension را بخوانید. اگر ابزار داده تکمیلی ندارد، آن را حدس نمی‌زند. برای تصمیم جدی، آدرس برنامه‌های مرتبط و مستندات پروژه را هم جداگانه بررسی کنید.'],
      ],
    };
  }
  if (path === '/tools/solana-token-tools') {
    return {
      title: 'راهنمای استفاده از ابزارهای توکن سولانا',
      intro: 'از این صفحه به‌عنوان نقطه شروع استفاده کنید؛ Scanner برای بررسی کلی Mint است و Token-2022 Inspector برای بررسی Extensionهای Token-2022.',
      items: [
        ['اول کدام ابزار را باز کنم؟', 'برای بیشتر کاربران از Solana Token Scanner شروع کنید. اگر Scanner نشان داد Mint از Token-2022 استفاده می‌کند، بعد سراغ Token-2022 Inspector بروید.'],
        ['چه چیزی لازم دارم؟', 'فقط Mint Address توکن. نیازی به اتصال کیف پول، Seed Phrase یا Private Key نیست. بهتر است آدرس را از منبع رسمی پروژه یا Explorer معتبر کپی کنید.'],
        ['آیا نتیجه یعنی توکن امن است؟', 'خیر. این ابزارها داده عمومی on-chain و بخشی از Market Data را به زبان ساده‌تر نشان می‌دهند. نتیجه برای تحقیق اولیه است، نه ممیزی امنیتی یا توصیه سرمایه‌گذاری.'],
      ],
    };
  }
  return null;
}

function mountToolGuide(path: string) {
  const existing = document.getElementById(TOOL_GUIDE_ID);
  if (existing) existing.remove();
  const data = guideData(path);
  if (!data) return;
  const main = document.querySelector('main');
  if (!main) return;

  const section = document.createElement('section');
  section.id = TOOL_GUIDE_ID;
  section.dir = 'rtl';
  section.setAttribute('aria-labelledby', `${TOOL_GUIDE_ID}-title`);
  section.className = 'relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6';

  const card = document.createElement('div');
  card.className = 'rounded-3xl border border-slate-800/80 bg-slate-950/70 p-5 sm:p-7';

  const heading = document.createElement('h2');
  heading.id = `${TOOL_GUIDE_ID}-title`;
  heading.className = 'text-xl font-black text-white sm:text-2xl';
  heading.textContent = data.title;
  card.appendChild(heading);

  const intro = document.createElement('p');
  intro.className = 'mt-3 max-w-3xl text-sm leading-7 text-slate-400';
  intro.textContent = data.intro;
  card.appendChild(intro);

  const list = document.createElement('div');
  list.className = 'mt-6 space-y-3';
  for (const [summaryText, bodyText] of data.items) {
    const details = document.createElement('details');
    details.className = 'group rounded-2xl border border-slate-800 bg-slate-900/50 px-4 sm:px-5';
    const summary = document.createElement('summary');
    summary.className = 'cursor-pointer list-none py-4 text-sm font-extrabold text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-[#14F195]/50';
    summary.textContent = summaryText;
    const body = document.createElement('div');
    body.className = 'border-t border-slate-800/80 pb-4 pt-3 text-sm leading-7 text-slate-400';
    body.textContent = bodyText;
    details.append(summary, body);
    list.appendChild(details);
  }

  const note = document.createElement('p');
  note.className = 'mt-5 text-xs leading-6 text-slate-500';
  note.textContent = 'این راهنما خلاصه است؛ برای تحلیل جدی، هر نتیجه را با داده‌های مستقل و منابع رسمی پروژه تطبیق دهید.';
  card.appendChild(list);
  card.appendChild(note);
  section.appendChild(card);
  main.appendChild(section);
}

async function mountMarketRisk(path: string) {
  const existing = document.getElementById(MARKET_RISK_ID);
  if (existing) existing.remove();
  if (path !== '/tools/solana-token-scanner') return;
  const mint = new URLSearchParams(window.location.search).get('mint');
  if (!mint) return;

  const main = document.querySelector('main');
  if (!main) return;
  const section = document.createElement('section');
  section.id = MARKET_RISK_ID;
  section.dir = 'rtl';
  section.className = 'relative z-10 mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6';
  section.innerHTML = '<div class="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-5 sm:p-7"><div class="flex items-center justify-between gap-4"><h2 class="text-lg font-black text-white">تحلیل بازار و ریسک</h2><span class="text-xs text-slate-500">On-chain + Market Data</span></div><p class="mt-3 text-sm text-slate-400">در حال دریافت تحلیل ترکیبی...</p></div>';
  main.appendChild(section);

  try {
    const response = await fetch(`/api/tools/token-risk?mint=${encodeURIComponent(mint)}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json() as any;
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'تحلیل بازار در دسترس نیست.');
    const levelClass = payload.summary?.level === 'high-attention' ? 'text-rose-300 border-rose-500/30 bg-rose-500/5' : payload.summary?.level === 'attention' ? 'text-amber-300 border-amber-500/30 bg-amber-500/5' : 'text-[#14F195] border-[#14F195]/20 bg-[#14F195]/5';
    const flags = Array.isArray(payload.flags) ? payload.flags : [];
    const availability = payload.availability || {};
    section.innerHTML = `<div class="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-5 sm:p-7"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 class="text-lg font-black text-white">تحلیل بازار و ریسک</h2><p class="mt-1 text-xs text-slate-500">ترکیب داده‌های on-chain با Market Data؛ این نتیجه توصیه سرمایه‌گذاری یا ممیزی امنیتی نیست.</p></div><span class="rounded-full border px-3 py-1 text-xs font-bold ${levelClass}">${payload.summary?.label || 'تحلیل فنی'}</span></div><div class="mt-4 flex flex-wrap gap-2 text-xs text-slate-500"><span class="rounded-full border border-slate-800 px-3 py-1">On-chain: ${availability.onChain ? 'در دسترس' : 'نامشخص'}</span><span class="rounded-full border border-slate-800 px-3 py-1">Market Data: ${availability.market ? 'در دسترس' : 'در دسترس نیست'}</span></div><div class="mt-5 grid gap-3 md:grid-cols-2">${flags.map((flag: any) => `<div class="rounded-xl border ${flag.severity === 'high' ? 'border-rose-500/30 bg-rose-500/5' : flag.severity === 'warning' ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800 bg-slate-900/50'} p-4"><div class="flex items-start justify-between gap-3"><span class="text-sm font-black text-slate-100">${String(flag.title || '').replace(/[<>]/g, '')}</span><span class="text-[10px] font-bold uppercase text-slate-500">${String(flag.severity || 'info')}</span></div><p class="mt-2 text-xs leading-6 text-slate-400">${String(flag.reason || '').replace(/[<>]/g, '')}</p></div>`).join('')}</div></div>`;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تحلیل بازار در حال حاضر در دسترس نیست.';
    section.innerHTML = `<div class="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-5 sm:p-7"><h2 class="text-lg font-black text-white">تحلیل بازار و ریسک</h2><p class="mt-2 text-sm leading-7 text-slate-400">${message.replace(/[<>]/g, '')}</p><p class="mt-2 text-xs text-slate-500">تحلیل on-chain توکن همچنان مستقل از Market Data قابل استفاده است.</p></div>`;
  }
}

export function applyToolSeo({ title, description, path, image = `${SITE_DOMAIN}/og-solmint.png` }: ToolSeoInput) {
  const canonicalUrl = `${SITE_DOMAIN}${path}`;
  const hasQuery = window.location.search.length > 0;

  document.title = title;

  upsertMeta('meta[name="title"]', { name: 'title' }, title);
  upsertMeta('meta[name="description"]', { name: 'description' }, description);
  upsertMeta(
    'meta[name="robots"]',
    { name: 'robots' },
    hasQuery
      ? 'noindex, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'
      : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
  );

  upsertMeta('meta[property="og:type"]', { property: 'og:type' }, 'website');
  upsertMeta('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl);
  upsertMeta('meta[property="og:title"]', { property: 'og:title' }, title);
  upsertMeta('meta[property="og:description"]', { property: 'og:description' }, description);
  upsertMeta('meta[property="og:image"]', { property: 'og:image' }, image);
  upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name' }, 'Solmint');
  upsertMeta('meta[property="og:locale"]', { property: 'og:locale' }, 'fa_IR');

  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary_large_image');
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, title);
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, description);
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, image);

  upsertLink('canonical', canonicalUrl);

  upsertJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: title,
    description,
    inLanguage: 'fa-IR',
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE_DOMAIN}#website`,
      url: SITE_DOMAIN,
      name: 'Solmint',
    },
  });

  window.requestAnimationFrame(() => {
    mountToolGuide(path);
    void mountMarketRisk(path);
  });
}
