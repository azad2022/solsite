const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_MINT_LENGTH = 44;

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=20, s-maxage=20, stale-while-revalidate=120',
  'CDN-Cache-Control': 'public, max-age=20, stale-while-revalidate=120',
  'Access-Control-Allow-Origin': 'https://solmint.ir',
  'X-Content-Type-Options': 'nosniff',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers });
}

function validMint(value: string): boolean {
  return value.length <= MAX_MINT_LENGTH && BASE58_RE.test(value);
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pick(obj: any, paths: string[]): unknown {
  for (const path of paths) {
    let current = obj;
    for (const part of path.split('.')) current = current?.[part];
    if (current !== undefined && current !== null) return current;
  }
  return null;
}

function buildFlags(token: any, market: any) {
  const flags: Array<{ code: string; severity: 'info' | 'warning' | 'high'; title: string; reason: string; evidence: unknown }> = [];
  const mintAuthority = pick(token, ['authorities.mint.address', 'authorities.mintAuthority', 'mintAuthority']);
  const freezeAuthority = pick(token, ['authorities.freeze.address', 'authorities.freezeAuthority', 'freezeAuthority']);
  const token2022 = Boolean(pick(token, ['token2022', 'isToken2022'])) || String(pick(token, ['tokenProgram', 'program'])) === 'Token-2022';
  const top10Pct = numberValue(pick(token, ['distribution.top10Percentage', 'top10Percentage', 'topAccounts.top10Percentage']));
  const marketAvailable = market?.ok === true;
  const pairCount = marketAvailable ? (numberValue(market?.pairCount) ?? 0) : null;
  const liquidity = marketAvailable ? (numberValue(market?.totalLiquidityUsd) ?? 0) : null;
  const volume = marketAvailable ? (numberValue(market?.totalVolume24h) ?? 0) : null;

  if (mintAuthority) flags.push({ code: 'mint-authority-active', severity: 'warning', title: 'Mint Authority فعال است', reason: 'از نظر فنی امکان تغییر عرضه توسط Authority وجود دارد.', evidence: mintAuthority });
  else flags.push({ code: 'mint-authority-revoked', severity: 'info', title: 'Mint Authority لغو شده است', reason: 'در داده فعلی Mint Authority فعال گزارش نشده است.', evidence: null });
  if (freezeAuthority) flags.push({ code: 'freeze-authority-active', severity: 'warning', title: 'Freeze Authority فعال است', reason: 'Authority مربوطه می‌تواند طبق Token Program روی وضعیت حساب‌های توکن اثر بگذارد.', evidence: freezeAuthority });
  else flags.push({ code: 'freeze-authority-revoked', severity: 'info', title: 'Freeze Authority لغو شده است', reason: 'Freeze Authority فعال گزارش نشده است.', evidence: null });
  if (top10Pct !== null) {
    if (top10Pct >= 50) flags.push({ code: 'high-concentration', severity: 'high', title: 'تمرکز بالای عرضه', reason: 'بیش از نیمی از عرضه در ۱۰ Token Account بزرگ مشاهده شده است.', evidence: top10Pct });
    else if (top10Pct >= 25) flags.push({ code: 'material-concentration', severity: 'warning', title: 'تمرکز قابل توجه عرضه', reason: 'بخش قابل توجهی از عرضه در ۱۰ Token Account بزرگ مشاهده شده است.', evidence: top10Pct });
    else flags.push({ code: 'lower-top10-concentration', severity: 'info', title: 'تمرکز ۱۰ حساب بزرگ پایین‌تر است', reason: 'سهم ۱۰ حساب بزرگ از آستانه‌های هشدار تعریف‌شده پایین‌تر است.', evidence: top10Pct });
  }
  if (token2022) flags.push({ code: 'token-2022', severity: 'info', title: 'Token-2022 شناسایی شد', reason: 'Mint از Token Extensions پشتیبانی می‌کند؛ Extensionها باید جداگانه بررسی شوند.', evidence: pick(token, ['extensions', 'token2022Extensions']) });

  if (!marketAvailable) {
    flags.push({ code: 'market-data-unavailable', severity: 'info', title: 'Market Data در دسترس نیست', reason: 'منبع Market Data در این بررسی پاسخ قابل استفاده‌ای نداد؛ این وضعیت نباید به‌عنوان نبود بازار تفسیر شود.', evidence: null });
  } else if (pairCount === 0) {
    flags.push({ code: 'no-market-pairs-found', severity: 'warning', title: 'Market Pair در منبع فعلی پیدا نشد', reason: 'در منبع Market Data فعلی Pairای برای این Mint پیدا نشد؛ این نتیجه اثبات نمی‌کند که توکن هیچ بازاری ندارد.', evidence: 0 });
  } else {
    if (liquidity !== null && liquidity > 0 && liquidity < 10000) flags.push({ code: 'thin-liquidity', severity: 'high', title: 'نقدینگی گزارش‌شده پایین است', reason: 'مجموع liquidity در Poolهای پیدا‌شده کمتر از ۱۰ هزار دلار است؛ چنین بازاری می‌تواند لغزش و نوسان بالایی داشته باشد.', evidence: liquidity });
    else if (liquidity !== null && liquidity > 0 && liquidity < 50000) flags.push({ code: 'limited-liquidity', severity: 'warning', title: 'نقدینگی گزارش‌شده محدود است', reason: 'نقدینگی قابل مشاهده برای معامله‌گری عمیق محدود به نظر می‌رسد.', evidence: liquidity });
    if (volume === 0) flags.push({ code: 'no-volume-reported', severity: 'warning', title: 'حجم ۲۴ ساعته گزارش نشده است', reason: 'منبع Market Data برای Poolهای پیدا‌شده حجم ۲۴ ساعته‌ای گزارش نکرده است.', evidence: 0 });
  }
  return flags;
}

function summary(flags: ReturnType<typeof buildFlags>) {
  const high = flags.filter(flag => flag.severity === 'high').length;
  const warning = flags.filter(flag => flag.severity === 'warning').length;
  if (high > 0) return { level: 'high-attention', label: 'نیازمند بررسی جدی', high, warning };
  if (warning > 0) return { level: 'attention', label: 'نیازمند بررسی', high, warning };
  return { level: 'informational', label: 'بدون هشدار فنی از معیارهای فعلی', high, warning };
}

async function fetchJson(url: string, timeoutMs = 9000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

async function fetchJsonSafe(url: string): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  try { return { ok: true, data: await fetchJson(url) }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'upstream unavailable' }; }
}

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const requestUrl = new URL(context.request.url);
  const mint = (requestUrl.searchParams.get('mint') || '').trim();
  if (!validMint(mint)) return json({ ok: false, error: 'آدرس Mint از نظر قالب Base58 معتبر نیست.' }, 400);
  const origin = requestUrl.origin;
  const [tokenResult, marketResult] = await Promise.all([
    fetchJsonSafe(`${origin}/api/tools/solana-token?mint=${encodeURIComponent(mint)}`),
    fetchJsonSafe(`${origin}/api/tools/market-context?mint=${encodeURIComponent(mint)}`),
  ]);
  if (!tokenResult.ok) return json({ ok: false, error: 'دریافت داده اصلی توکن از شبکه در حال حاضر ممکن نیست.', code: 'ONCHAIN_UNAVAILABLE', availability: { onChain: false, market: marketResult.ok } }, 503);
  const token = tokenResult.data;
  const market = marketResult.ok ? marketResult.data : { ok: false, code: 'UPSTREAM_UNAVAILABLE' };
  const flags = buildFlags(token, market);
  const result = summary(flags);
  return json({
    ok: true,
    mint,
    observedAt: new Date().toISOString(),
    summary: result,
    flags,
    sources: { onChain: 'Solana RPC via Solmint Token Scanner', market: marketResult.ok ? (market?.source || 'dexscreener') : 'unavailable' },
    methodology: { version: 1, explainable: true, note: 'این پروفایل یک تحلیل فنی و rule-based بر اساس داده‌های قابل مشاهده است؛ ممیزی امنیتی، تشخیص قطعی کلاهبرداری یا توصیه سرمایه‌گذاری نیست.' },
    availability: { onChain: true, market: marketResult.ok && Boolean(market?.ok) },
  });
}
