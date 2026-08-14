const DEXSCREENER_BASE = 'https://api.dexscreener.com/token-pairs/v1/solana';
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

async function fetchWithTimeout(url: string, timeoutMs = 7000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timer);
  }
}

function numeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function summarizePair(pair: any) {
  const liquidityUsd = numeric(pair?.liquidity?.usd);
  const volume24h = numeric(pair?.volume?.h24);
  const txns24h = pair?.txns?.h24;
  const buys24h = numeric(txns24h?.buys) ?? 0;
  const sells24h = numeric(txns24h?.sells) ?? 0;
  const priceUsd = numeric(pair?.priceUsd);
  const priceChange24h = numeric(pair?.priceChange?.h24);

  return {
    dexId: typeof pair?.dexId === 'string' ? pair.dexId : null,
    pairAddress: typeof pair?.pairAddress === 'string' ? pair.pairAddress : null,
    url: typeof pair?.url === 'string' ? pair.url : null,
    baseToken: pair?.baseToken ?? null,
    quoteToken: pair?.quoteToken ?? null,
    priceUsd,
    priceNative: typeof pair?.priceNative === 'string' ? pair.priceNative : null,
    liquidityUsd,
    volume24h,
    buys24h,
    sells24h,
    priceChange24h,
    fdv: numeric(pair?.fdv),
    marketCap: numeric(pair?.marketCap),
    pairCreatedAt: numeric(pair?.pairCreatedAt),
    labels: Array.isArray(pair?.labels) ? pair.labels.filter((x: unknown) => typeof x === 'string') : [],
    info: pair?.info ?? null,
  };
}

function rankPairs(pairs: any[]) {
  return pairs
    .map(summarizePair)
    .filter(pair => pair.pairAddress)
    .sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
}

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const url = new URL(context.request.url);
  const mint = (url.searchParams.get('mint') || '').trim();

  if (!validMint(mint)) {
    return json({ ok: false, error: 'آدرس Mint از نظر قالب Base58 معتبر نیست.' }, 400);
  }

  try {
    const response = await fetchWithTimeout(`${DEXSCREENER_BASE}/${encodeURIComponent(mint)}`);
    if (response.status === 429) {
      return json({ ok: false, error: 'سرویس داده بازار موقتاً به محدودیت درخواست رسیده است.', code: 'UPSTREAM_RATE_LIMIT' }, 503);
    }
    if (!response.ok) {
      return json({ ok: false, error: 'دریافت داده بازار از منبع بیرونی ناموفق بود.', code: 'UPSTREAM_ERROR' }, 502);
    }

    const payload = await response.json() as unknown;
    const pairs = Array.isArray(payload) ? rankPairs(payload) : [];
    const totalLiquidityUsd = pairs.reduce((sum, pair) => sum + (pair.liquidityUsd ?? 0), 0);
    const totalVolume24h = pairs.reduce((sum, pair) => sum + (pair.volume24h ?? 0), 0);
    const totalBuys24h = pairs.reduce((sum, pair) => sum + pair.buys24h, 0);
    const totalSells24h = pairs.reduce((sum, pair) => sum + pair.sells24h, 0);
    const pricedPairs = pairs.filter(pair => pair.priceUsd !== null);
    const primaryPair = pairs[0] ?? null;

    return json({
      ok: true,
      mint,
      source: 'dexscreener',
      sourceLabel: 'DEX Screener',
      observedAt: new Date().toISOString(),
      pairCount: pairs.length,
      totalLiquidityUsd,
      totalVolume24h,
      totalBuys24h,
      totalSells24h,
      pricedPairCount: pricedPairs.length,
      primaryPair,
      pairs: pairs.slice(0, 12),
      caveats: [
        'این داده‌ها Market Data هستند و مستقیماً از وضعیت Accountهای Solana استخراج نشده‌اند.',
        'Liquidity جمع ساده نقدینگی Poolهای پیدا‌شده است و نباید آن را معادل نقدینگی قابل خروج با هر حجم معامله دانست.',
        'قیمت و حجم می‌توانند بین DEXها و Poolها تفاوت داشته باشند و در بازارهای کم‌عمق نوسان زیادی داشته باشند.',
        'نبودن Pair در این منبع به‌تنهایی به معنی نبودن بازار در کل اکوسیستم سولانا نیست.',
      ],
    });
  } catch (error) {
    console.warn('Market context lookup failed:', error);
    return json({ ok: false, error: 'منبع داده بازار در دسترس نیست؛ تحلیل on-chain بدون Market Data همچنان قابل انجام است.', code: 'UPSTREAM_UNAVAILABLE' }, 503);
  }
}
