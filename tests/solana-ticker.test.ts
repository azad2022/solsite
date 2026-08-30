import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet } from '../functions/api/market/solana-ticker.ts';

function mockKraken(payload: unknown, status = 200) {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

test('parses Kraken ticker open price when field is a string', async () => {
  const restore = mockKraken({
    error: [],
    result: { SOLUSD: { c: ['106.32000'], o: '105.62000' } },
  });

  try {
    const response = await onRequestGet();
    assert.equal(response.status, 200);
    const body = await response.json() as { price: number; change24h: number; source: string; pair: string };
    assert.equal(body.price, 106.32);
    assert.equal(body.source, 'Kraken');
    assert.equal(body.pair, 'SOL/USD');
    assert.ok(Math.abs(body.change24h - 0.6627532668055217) < 1e-10);
  } finally {
    restore();
  }
});

test('also accepts array-form ticker fields without changing output', async () => {
  const restore = mockKraken({
    error: [],
    result: { SOLUSD: { c: ['106.32000'], o: ['105.62000'] } },
  });

  try {
    const response = await onRequestGet();
    assert.equal(response.status, 200);
    const body = await response.json() as { price: number; change24h: number };
    assert.equal(body.price, 106.32);
    assert.ok(Math.abs(body.change24h - 0.6627532668055217) < 1e-10);
  } finally {
    restore();
  }
});
