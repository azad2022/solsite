const KRAKEN_TICKER_URL = 'https://api.kraken.com/0/public/Ticker?pair=SOLUSD';

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': 'https://solmint.ir',
  'X-Content-Type-Options': 'nosniff',
};

type KrakenTickerField = string | string[] | undefined;

type KrakenTicker = {
  error?: string[];
  result?: Record<string, { c?: KrakenTickerField; o?: KrakenTickerField }>;
};

function toFiniteNumber(value: KrakenTickerField): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export const onRequestGet = async () => {
  try {
    const response = await fetch(KRAKEN_TICKER_URL, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      return Response.json({ error: ['Market data temporarily unavailable'] }, { status: 502, headers });
    }

    const payload = await response.json() as KrakenTicker;
    if (Array.isArray(payload.error) && payload.error.length) {
      return Response.json({ error: ['Market provider returned an error'] }, { status: 502, headers });
    }

    const key = Object.keys(payload.result ?? {})[0];
    const ticker = key ? payload.result?.[key] : undefined;
    const price = toFiniteNumber(ticker?.c);
    const open24h = toFiniteNumber(ticker?.o);

    if (price === null || price <= 0) {
      return Response.json({ error: ['Invalid market price'] }, { status: 502, headers });
    }

    const change24h = open24h !== null && open24h > 0
      ? ((price / open24h) - 1) * 100
      : null;

    return Response.json({
      symbol: 'SOL',
      pair: 'SOL/USD',
      price,
      change24h,
      source: 'Kraken',
      fetchedAt: new Date().toISOString(),
    }, { status: 200, headers });
  } catch {
    return Response.json({ error: ['Market data temporarily unavailable'] }, { status: 502, headers });
  }
};
