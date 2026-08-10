interface Env {
  KRAKEN_API_BASE?: string;
  BINANCE_API_BASE?: string;
  BYBIT_API_BASE?: string;
  COINBASE_API_BASE?: string;
}

const KRAKEN_API_BASE = 'https://api.kraken.com/0/public/OHLC';
const BINANCE_API_BASE = 'https://api.binance.com/api/v3/klines';
const BYBIT_API_BASE = 'https://api.bybit.com/v5/market/kline';
const COINBASE_API_BASE = 'https://api.exchange.coinbase.com/products/SOL-USD/candles';
const ALLOWED_INTERVALS = new Set(['1', '5', '15', '60', '240', '1440']);
const BINANCE_INTERVALS: Record<string, string> = {
  '1': '1m',
  '5': '5m',
  '15': '15m',
  '60': '1h',
  '240': '4h',
  '1440': '1d'
};
const BYBIT_INTERVALS: Record<string, string> = {
  '1': '1',
  '5': '5',
  '15': '15',
  '60': '60',
  '240': '240',
  '1440': 'D'
};
const COINBASE_GRANULARITY: Record<string, number> = {
  '1': 60,
  '5': 300,
  '15': 900,
  '60': 3600,
  '240': 21600,
  '1440': 86400
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

function validateRows(rows: unknown[][], source: string): unknown[][] {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`${source} returned no candles`);
  const valid = rows.filter((row) => Array.isArray(row) && row.length >= 5 && [0, 1, 2, 3, 4].every((i) => Number.isFinite(Number(row[i]))));
  if (!valid.length) throw new Error(`${source} returned invalid candles`);
  return valid;
}

async function getFromBinance(interval: string): Promise<unknown[][]> {
  const binanceInterval = BINANCE_INTERVALS[interval];
  const url = `${BINANCE_API_BASE}?symbol=SOLUSDT&interval=${binanceInterval}&limit=500`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
  const json = await response.json() as unknown;
  if (!Array.isArray(json)) throw new Error('Binance returned invalid data');

  return validateRows(json.map((row: any[]) => [
    Number(row[0]) / 1000,
    String(row[1]),
    String(row[2]),
    String(row[3]),
    String(row[4]),
    '0',
    String(row[5])
  ]), 'Binance');
}

async function getFromKraken(interval: string): Promise<unknown[][]> {
  const url = `${KRAKEN_API_BASE}?pair=SOLUSD&interval=${interval}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Kraken HTTP ${response.status}`);
  const json = await response.json() as any;
  if (Array.isArray(json?.error) && json.error.length) throw new Error(`Kraken: ${json.error.join(', ')}`);
  const key = Object.keys(json?.result ?? {}).find(item => item !== 'last');
  const rows = key ? json.result[key] : null;
  return validateRows(rows, 'Kraken');
}

async function getFromBybit(interval: string): Promise<unknown[][]> {
  const bybitInterval = BYBIT_INTERVALS[interval];
  const url = `${BYBIT_API_BASE}?category=spot&symbol=SOLUSDT&interval=${bybitInterval}&limit=500`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Bybit HTTP ${response.status}`);
  const json = await response.json() as any;
  if (json?.retCode !== 0) throw new Error(`Bybit: ${json?.retMsg || 'request failed'}`);
  const rows = Array.isArray(json?.result?.list) ? json.result.list : [];

  // Bybit returns newest-first: [startTime, open, high, low, close, volume, turnover].
  return validateRows(rows.map((row: any[]) => [
    Number(row[0]) / 1000,
    String(row[1]),
    String(row[2]),
    String(row[3]),
    String(row[4]),
    '0',
    String(row[5])
  ]).reverse(), 'Bybit');
}

async function getFromCoinbase(interval: string): Promise<unknown[][]> {
  const granularity = COINBASE_GRANULARITY[interval];
  const url = `${COINBASE_API_BASE}?granularity=${granularity}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Coinbase HTTP ${response.status}`);
  const json = await response.json() as unknown;
  if (!Array.isArray(json)) throw new Error('Coinbase returned invalid data');

  // Coinbase returns [time, low, high, open, close, volume], newest-first.
  return validateRows(json.map((row: any[]) => [
    Number(row[0]),
    String(row[3]),
    String(row[2]),
    String(row[1]),
    String(row[4]),
    '0',
    String(row[5])
  ]).reverse(), 'Coinbase');
}

export const onRequestGet = async ({ request }: { request: Request; env?: Env }) => {
  const incoming = new URL(request.url);
  const interval = incoming.searchParams.get('interval') || '60';

  if (!ALLOWED_INTERVALS.has(interval)) {
    return Response.json({ error: ['Invalid interval'] }, { status: 400, headers: responseHeaders });
  }

  const sources = [
    ['Binance', getFromBinance],
    ['Kraken', getFromKraken],
    ['Bybit', getFromBybit],
    ['Coinbase', getFromCoinbase]
  ] as const;

  for (const [name, loader] of sources) {
    try {
      const rows = await loader(interval);
      return new Response(JSON.stringify({
        error: [],
        result: {
          SOLUSDT: rows,
          last: rows.length ? rows[rows.length - 1][0] : null,
          source: name
        }
      }), { status: 200, headers: responseHeaders });
    } catch (error) {
      console.warn(`${name} OHLC failed:`, error);
    }
  }

  console.error('All Solana OHLC market-data providers failed');
  return Response.json(
    { error: ['Market data temporarily unavailable'] },
    { status: 502, headers: responseHeaders }
  );
};
