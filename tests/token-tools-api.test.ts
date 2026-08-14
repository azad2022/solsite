import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as riskGet } from '../functions/api/tools/token-risk.ts';
import { onRequestGet as marketGet } from '../functions/api/tools/market-context.ts';

const VALID_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const originalFetch = globalThis.fetch;

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

test('market context rejects malformed mint addresses', async () => {
  const result = await marketGet({ request: new Request('https://solmint.ir/api/tools/market-context?mint=not-valid') });
  assert.equal(result.status, 400);
  const body = await result.json() as { ok: boolean };
  assert.equal(body.ok, false);
});

test('market context normalizes DEX pairs and aggregates liquidity', async () => {
  globalThis.fetch = async () => response([
    { dexId: 'raydium', pairAddress: 'pair-1', url: 'https://dex.example/pair-1', priceUsd: '1.25', liquidity: { usd: 1200 }, volume: { h24: 3000 }, txns: { h24: { buys: 7, sells: 5 } }, priceChange: { h24: 4 }, fdv: 100000, marketCap: 90000 },
    { dexId: 'orca', pairAddress: 'pair-2', url: 'https://dex.example/pair-2', priceUsd: '1.20', liquidity: { usd: 800 }, volume: { h24: 1000 }, txns: { h24: { buys: 3, sells: 2 } }, priceChange: { h24: -2 }, fdv: 95000, marketCap: 85000 },
  ]);
  try {
    const result = await marketGet({ request: new Request(`https://solmint.ir/api/tools/market-context?mint=${VALID_MINT}`) });
    assert.equal(result.status, 200);
    const body = await result.json() as { ok: boolean; pairCount: number; totalLiquidityUsd: number; totalVolume24h: number; totalBuys24h: number; totalSells24h: number };
    assert.equal(body.ok, true);
    assert.equal(body.pairCount, 2);
    assert.equal(body.totalLiquidityUsd, 2000);
    assert.equal(body.totalVolume24h, 4000);
    assert.equal(body.totalBuys24h, 10);
    assert.equal(body.totalSells24h, 7);
  } finally { globalThis.fetch = originalFetch; }
});

test('risk engine keeps on-chain analysis available when market data fails', async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/api/tools/solana-token')) return response({
      ok: true,
      mint: VALID_MINT,
      tokenProgram: 'Token-2022',
      mintAuthority: VALID_MINT,
      freezeAuthority: null,
      distribution: { top10Percentage: 61.5 },
      extensions: [{ type: 'TransferFeeConfig' }],
    });
    if (url.includes('/api/tools/market-context')) return response({ ok: false, code: 'UPSTREAM_UNAVAILABLE' }, 503);
    throw new Error(`Unexpected URL: ${url}`);
  };
  try {
    const result = await riskGet({ request: new Request(`https://solmint.ir/api/tools/token-risk?mint=${VALID_MINT}`) });
    assert.equal(result.status, 200);
    const body = await result.json() as { ok: boolean; availability: { onChain: boolean; market: boolean }; flags: Array<{ code: string; severity: string }> };
    assert.equal(body.ok, true);
    assert.equal(body.availability.onChain, true);
    assert.equal(body.availability.market, false);
    assert.equal(body.flags.find(flag => flag.code === 'mint-authority-active')?.severity, 'warning');
    assert.equal(body.flags.find(flag => flag.code === 'high-concentration')?.severity, 'high');
  } finally { globalThis.fetch = originalFetch; }
});

test('risk engine rejects malformed mint before any upstream request', async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return response({}); };
  try {
    const result = await riskGet({ request: new Request('https://solmint.ir/api/tools/token-risk?mint=invalid') });
    assert.equal(result.status, 400);
    assert.equal(called, false);
  } finally { globalThis.fetch = originalFetch; }
});
