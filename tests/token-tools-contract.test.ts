import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet as onSolanaTokenGet } from '../functions/api/tools/solana-token.ts';
import { onRequestGet as onMarketContextGet } from '../functions/api/tools/market-context.ts';

const MINT = 'So11111111111111111111111111111111111111112';

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function installFetch(handler: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => handler(new URL(String(input)), init)) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

test('Solana token analyzer rejects malformed mint before RPC access', async () => {
  let calls = 0;
  const restore = installFetch(() => { calls += 1; return response({}); });
  try {
    const result = await onSolanaTokenGet({ request: new Request('https://solmint.ir/api/tools/solana-token?mint=not-a-mint') });
    assert.equal(result.status, 400);
    assert.equal(calls, 0);
    const body = await result.json() as { ok: boolean; error: string };
    assert.equal(body.ok, false);
    assert.match(body.error, /Base58/);
  } finally {
    restore();
  }
});

test('Solana token analyzer degrades to a controlled upstream error when RPC fails', async () => {
  const restore = installFetch(() => response({ error: 'rpc unavailable' }, 503));
  try {
    const result = await onSolanaTokenGet({ request: new Request(`https://solmint.ir/api/tools/solana-token?mint=${MINT}`) });
    assert.equal(result.status, 502);
    const body = await result.json() as { ok: boolean; error: string };
    assert.equal(body.ok, false);
    assert.match(body.error, /Solana/);
  } finally {
    restore();
  }
});

test('Market context rejects malformed mint before calling DEX Screener', async () => {
  let calls = 0;
  const restore = installFetch(() => { calls += 1; return response([]); });
  try {
    const result = await onMarketContextGet({ request: new Request('https://solmint.ir/api/tools/market-context?mint=bad') });
    assert.equal(result.status, 400);
    assert.equal(calls, 0);
  } finally {
    restore();
  }
});

test('Market context converts rate limiting into a controlled 503 response', async () => {
  const restore = installFetch(() => response({ message: 'rate limited' }, 429));
  try {
    const result = await onMarketContextGet({ request: new Request(`https://solmint.ir/api/tools/market-context?mint=${MINT}`) });
    assert.equal(result.status, 503);
    const body = await result.json() as { ok: boolean; code: string };
    assert.equal(body.ok, false);
    assert.equal(body.code, 'UPSTREAM_RATE_LIMIT');
  } finally {
    restore();
  }
});

test('Market context ranks pairs by liquidity and aggregates market observations', async () => {
  const restore = installFetch(() => response([
    {
      dexId: 'dex-low', pairAddress: 'pair-low', priceUsd: '1.00',
      liquidity: { usd: 1000 }, volume: { h24: 200 },
      txns: { h24: { buys: 2, sells: 3 } }, priceChange: { h24: -1 },
    },
    {
      dexId: 'dex-high', pairAddress: 'pair-high', priceUsd: '2.00',
      liquidity: { usd: 9000 }, volume: { h24: 800 },
      txns: { h24: { buys: 7, sells: 5 } }, priceChange: { h24: 4 },
    },
  ]));
  try {
    const result = await onMarketContextGet({ request: new Request(`https://solmint.ir/api/tools/market-context?mint=${MINT}`) });
    assert.equal(result.status, 200);
    const body = await result.json() as any;
    assert.equal(body.ok, true);
    assert.equal(body.pairCount, 2);
    assert.equal(body.totalLiquidityUsd, 10000);
    assert.equal(body.totalVolume24h, 1000);
    assert.equal(body.totalBuys24h, 9);
    assert.equal(body.totalSells24h, 8);
    assert.equal(body.primaryPair.pairAddress, 'pair-high');
    assert.equal(body.pairs[0].pairAddress, 'pair-high');
  } finally {
    restore();
  }
});
