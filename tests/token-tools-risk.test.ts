import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet } from '../functions/api/tools/token-risk';

const MINT = 'So11111111111111111111111111111111111111112';

function installFetch(onChain: any, market: any) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/tools/market-context')) {
      return new Response(JSON.stringify(market), { status: market.ok === false ? 503 : 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify(onChain), { status: onChain.ok === false ? 503 : 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

function installFetchWithMarketFailure(onChain: any) {
  return installFetch(onChain, { ok: false, code: 'UPSTREAM_5XX' });
}

test('returns explainable high-attention flags from on-chain and market evidence', async () => {
  const restore = installFetch(
    {
      ok: true,
      tokenProgram: 'TokenkegQfeZyiNwAJYbNbGKPFXCWuBvf9Ss623VQ5DA',
      authorities: { mint: { address: 'MintAuthority1111111111111111111111111111111' } },
      distribution: { top10Percentage: 62 },
    },
    { ok: true, source: 'dexscreener', pairCount: 1, totalLiquidityUsd: 5000, totalVolume24h: 1000 },
  );
  try {
    const result = await onRequestGet({ request: new Request(`https://solmint.ir/api/tools/token-risk?mint=${MINT}`) });
    assert.equal(result.status, 200);
    const body = await result.json() as any;
    assert.equal(body.summary.level, 'high-attention');
    assert.equal(body.methodology.explainable, true);
    assert.equal(body.availability.onChain, true);
    assert.equal(body.availability.market, true);
    assert.ok(body.flags.some((flag: any) => flag.code === 'high-concentration' && flag.severity === 'high'));
    assert.ok(body.flags.some((flag: any) => flag.code === 'mint-authority-active'));
    assert.ok(body.flags.some((flag: any) => flag.code === 'thin-liquidity'));
  } finally {
    restore();
  }
});

test('distinguishes unavailable market data from an empty market result', async () => {
  const restore = installFetch(
    {
      ok: true,
      tokenProgram: 'TokenkegQfeZyiNwAJYbNbGKPFXCWuBvf9Ss623VQ5DA',
      authorities: {},
      distribution: { top10Percentage: 12 },
    },
    { ok: false, code: 'UPSTREAM_UNAVAILABLE' },
  );
  try {
    const result = await onRequestGet({ request: new Request(`https://solmint.ir/api/tools/token-risk?mint=${MINT}`) });
    assert.equal(result.status, 200);
    const body = await result.json() as any;
    const flag = body.flags.find((item: any) => item.code === 'market-data-unavailable');
    assert.equal(flag?.severity, 'info');
    assert.equal(body.flags.some((item: any) => item.code === 'no-market-pairs-found'), false);
    assert.equal(body.availability.market, false);
  } finally {
    restore();
  }
});

test('reports a real empty market result as a market observation', async () => {
  const restore = installFetch(
    {
      ok: true,
      tokenProgram: 'TokenkegQfeZyiNwAJYbNbGKPFXCWuBvf9Ss623VQ5DA',
      authorities: {},
      distribution: { top10Percentage: 12 },
    },
    { ok: true, source: 'dexscreener', pairCount: 0, totalLiquidityUsd: 0, totalVolume24h: 0 },
  );
  try {
    const result = await onRequestGet({ request: new Request(`https://solmint.ir/api/tools/token-risk?mint=${MINT}`) });
    assert.equal(result.status, 200);
    const body = await result.json() as any;
    const flag = body.flags.find((item: any) => item.code === 'no-market-pairs-found');
    assert.equal(flag?.severity, 'warning');
    assert.match(flag?.reason ?? '', /اثبات نمی‌کند/);
    assert.equal(body.availability.market, true);
  } finally {
    restore();
  }
});

test('keeps on-chain risk analysis available when market endpoint returns HTTP 5xx', async () => {
  const restore = installFetchWithMarketFailure({
    ok: true,
    tokenProgram: 'TokenkegQfeZyiNwAJYbNbGKPFXCWuBvf9Ss623VQ5DA',
    authorities: { mint: { address: 'MintAuthority1111111111111111111111111111111' } },
    distribution: { top10Percentage: 10 },
  });
  try {
    const result = await onRequestGet({ request: new Request(`https://solmint.ir/api/tools/token-risk?mint=${MINT}`) });
    assert.equal(result.status, 200);
    const body = await result.json() as any;
    assert.equal(body.ok, true);
    assert.equal(body.availability.onChain, true);
    assert.equal(body.availability.market, false);
    assert.ok(body.flags.some((flag: any) => flag.code === 'market-data-unavailable' && flag.severity === 'info'));
  } finally {
    restore();
  }
});
