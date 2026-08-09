interface Env {
  KRAKEN_API_BASE?: string;
}

const KRAKEN_API_BASE = 'https://api.kraken.com/0/public/OHLC';
const ALLOWED_INTERVALS = new Set(['1', '5', '15', '60', '240', '1440']);

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const incoming = new URL(request.url);
  const interval = incoming.searchParams.get('interval') || '60';
  if (!ALLOWED_INTERVALS.has(interval)) {
    return Response.json({ error: ['Invalid interval'] }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = `${env.KRAKEN_API_BASE || KRAKEN_API_BASE}?pair=SOLUSD&interval=${interval}`;
  try {
    // Cloudflare Pages Functions supports the `cf` fetch option at runtime,
    // but the project's TypeScript lib uses the standard RequestInit type.
    // Keep the Cloudflare cache controls while extending the init object only
    // at this boundary so `tsc` can validate the rest of the request normally.
    const fetchInit: RequestInit & { cf?: { cacheTtl: number; cacheEverything: boolean } } = {
      headers: { Accept: 'application/json', 'User-Agent': 'SolMint/1.0 market-data-proxy' },
      cf: { cacheTtl: 15, cacheEverything: true }
    };
    const response = await fetch(url, fetchInit);
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=10, s-maxage=15, stale-while-revalidate=60',
        'Access-Control-Allow-Origin': 'https://solmint.ir',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    console.error('Solana OHLC proxy error:', error);
    return Response.json({ error: ['Market data temporarily unavailable'] }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
};
