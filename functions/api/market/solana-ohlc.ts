interface Env {
  KRAKEN_API_BASE?: string;
  BINANCE_API_BASE?: string;
}

const KRAKEN_API_BASE = 'https://api.kraken.com/0/public/OHLC';
const BINANCE_API_BASE = 'https://api.binance.com/api/v3/klines';
const ALLOWED_INTERVALS = new Set(['1', '5', '15', '60', '240', '1440']);
const BINANCE_INTERVALS: Record<string, string> = {
  '1': '1m',
  '5': '5m',
  '15': '15m',
  '60': '1h',
  '240': '4h',
  '1440': '1d'
};

const responseHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': 'https://solmint.ir',
  'X-Content-Type-Options': 'nosniff'
};

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SolMint/1.0 market-data-proxy'
      },
      signal: controller.signal,
      cache: 'no-store'
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function getFromBinance(interval: string): Promise<unknown[][]> {
  const binanceInterval = BINANCE_INTERVALS[interval];
  const url = `${BINANCE_API_BASE}?symbol=SOLUSDT&interval=${binanceInterval}&limit=500`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
  const json = await response.json() as unknown;
  if (!Array.isArray(json) || json.length === 0) throw new Error('Binance returned no candles');

  // Convert Binance kline format to the Kraken-compatible OHLC row shape
  // consumed by SolanaPricePage.tsx: [time, open, high, low, close, ..., volume].
  return json.map((row: any[]) => [
    Number(row[0]) / 1000,
    String(row[1]),
    String(row[2]),
    String(row[3]),
    String(row[4]),
    '0',
    String(row[5])
  ]);
}

async function getFromKraken(interval: string): Promise<unknown[][]> {
  const url = `${KRAKEN_API_BASE}?pair=SOLUSD&interval=${interval}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Kraken HTTP ${response.status}`);
  const json = await response.json() as any;
  if (Array.isArray(json?.error) && json.error.length) throw new Error(`Kraken: ${json.error.join(', ')}`);
  const key = Object.keys(json?.result ?? {}).find(item => item !== 'last');
  const rows = key ? json.result[key] : null;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Kraken returned no candles');
  return rows;
}

export const onRequestGet = async ({ request }: { request: Request; env?: Env }) => {
  const incoming = new URL(request.url);
  const interval = incoming.searchParams.get('interval') || '60';

  if (!ALLOWED_INTERVALS.has(interval)) {
    return Response.json({ error: ['Invalid interval'] }, { status: 400, headers: responseHeaders });
  }

  try {
    let rows: unknown[][];
    try {
      rows = await getFromBinance(interval);
    } catch (binanceError) {
      console.warn('Binance OHLC failed, trying Kraken:', binanceError);
      rows = await getFromKraken(interval);
    }

    return new Response(JSON.stringify({
      error: [],
      result: {
        SOLUSDT: rows,
        last: rows.length ? rows[rows.length - 1][0] : null
      }
    }), { status: 200, headers: responseHeaders });
  } catch (error) {
    console.error('Solana OHLC proxy error:', error);
    return Response.json(
      { error: ['Market data temporarily unavailable'] },
      { status: 502, headers: responseHeaders }
    );
  }
};
