import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet } from '../functions/api/tools/market-context.ts';

const MINT = 'So11111111111111111111111111111111111111112';

function restoreFetch() {
  const original = globalThis.fetch;
  return () => { globalThis.fetch = original; };
}

test('normalizes pairs, ranks by liquidity, and returns market caveats', async () => {
  const restore = restoreFetch();
  globalThis.fetch = (async () => new Response(JSON.stringify([
    {
      dexId: 'low-liquidity-dex',
      pairAddress: 'pair-low',
      url: 'https://dex.example/low',
      priceUsd: '1.25',
      liquidity: { usd: 1000 },
      volume: { h24: 200 },
      txns: { h24: { buys: 3, sells: 2 } },
      priceChange: { h24: -4.5 },
      fdv: 100000,
      marketCap: 90000,
    },
    {
      dexId: 'deep-dex',
      pairAddress: 'pair-deep',
      url: 'https://dex.example/deep',
      priceUsd: '1.30',
      liquidity: { usd: 25000 },
      volume: { h24: 900 },
      txns: { h24: { buys: 8, sells: 5 } },
      priceChange: { h24: 2.2 },
      fdv: 120000,
      marketCap: 110000,
    },
  ]), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;

  try {
    const result = await onRequestGet({ request: new Request(`https://solmint.ir/api/tools/market-context?mint=${MINT}`) });
    assert.equal(result.status, 200);
    const body = await result.json() as any;
    assert.equal(body.ok, true);
    assert.equal(body.pairCount, 2);
    assert.equal(body.primaryPair.pairAddress, 'pair-deep');
    assert.equal(body.totalLiquidityUsd, 26000);
    assert.equal(body.totalVolume24h, 1100);
    assert.equal(body.totalBuys24h, 11);
    assert.equal(body.totalSells24h, 7);
    assert.equal(body.pricedPairCount, 2);
    assert.equal(body.source, 'dexscreener');
    assert.equal(body.caveats.length, 4);
  } finally {
    restore();
  }
});

test('maps upstream rate limiting to a controlled 503', async () => {
  const restore = restoreFetch();
  globalThis.fetch = (async () => new Response('{}', { status: 429 })) as typeof fetch;
  try {
    const result = await onRequestGet({ request: new Request(`https://solmint.ir/api/tools/market-context?mint=${MINT}`) });
    assert.equal(result.status, 503);
    const body = await result.json() as any;
    assert.equal(body.ok, false);
    assert.equal(body.code, 'UPSTREAM_RATE_LIMIT');
  } finally {
    restore();
  }
});
