import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet } from '../functions/api/tools/token-risk.ts';

const MINT = 'So11111111111111111111111111111111111111112';

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function installFetch(token: unknown, market: unknown) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/api/tools/solana-token')) return response(token);
    if (url.pathname.endsWith('/api/tools/market-context')) return response(market);
    return response({ ok: false }, 404);
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

function installFetchWithMarketFailure(token: unknown) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/api/tools/solana-token')) return response(token);
    if (url.pathname.endsWith('/api/tools/market-context')) return response({ error: 'upstream timeout' }, 504);
    return response({ ok: false }, 404);
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

test('rejects malformed mint before upstream calls', async () => {
  const restore = installFetch({}, {});
  try {
    const result = await onRequestGet({ request: new Request('https://solmint.ir/api/tools/token-risk?mint=not-a-mint') });
    assert.equal(result.status, 400);
    const body = await result.json() as { ok: boolean; error: string };
    assert.equal(body.ok, false);
    assert.match(body.error, /Base58/);
  } finally {
    restore();
  }
});

test('returns explainable high-attention flags from on-chain and market evidence', async () => {
  const restore = installFetch(
    {
      ok: true,
      tokenProgram: 'Token-2022',
      token2022: true,
      authorities: {
        mint: { address: 'MintAuthority1111111111111111111111111111111' },
        freeze: { address: 'FreezeAuthority111111111111111111111111111111' },
      },
      distribution: { top10Percentage: 62.5 },
      extensions: ['TransferFeeConfig'],
    },
    {
      ok: true,
      source: 'dexscreener',
      pairCount: 1,
      totalLiquidityUsd: 6500,
      totalVolume24h: 1250,
    },
  );
  try {
    const result = await onRequestGet({ request: new Request(`https://solmint.ir/api/tools/token-risk?mint=${MINT}`) });
    assert.equal(result.status, 200);
    const body = await result.json() as any;
    assert.equal(body.ok, true);
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

test('does not turn missing market data into a false claim that no market exists', async () => {
  const restore = installFetch(
    {
      ok: true,
      tokenProgram: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      authorities: {},
      distribution: { top10Percentage: 12 },
    },
    { ok: false, code: 'UPSTREAM_UNAVAILABLE' },
  );
  try {
    const result = await onRequestGet({ request: new Request(`https://solmint.ir/api/tools/token-risk?mint=${MINT}`) });
    assert.equal(result.status, 200);
    const body = await result.json() as any;
    const flag = body.flags.find((item: any) => item.code === 'no-market-pairs-found');
    assert.equal(flag?.severity, 'warning');
    assert.match(flag?.reason ?? '', /اثبات نمی‌کند/);
    assert.equal(body.availability.market, false);
  } finally {
    restore();
  }
});

test('keeps on-chain risk analysis available when market endpoint returns HTTP 5xx', async () => {
  const restore = installFetchWithMarketFailure({
    ok: true,
    tokenProgram: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
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
    assert.ok(body.flags.some((flag: any) => flag.code === 'no-market-pairs-found'));
    assert.ok(body.flags.some((flag: any) => flag.code === 'mint-authority-active'));
  } finally {
    restore();
  }
});
