import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/tools/solana-token.ts';

const VALID_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const originalFetch = globalThis.fetch;

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

test('solana token scanner rejects malformed mint without upstream request', async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return response({}); };
  try {
    const result = await onRequestGet({ request: new Request('https://solmint.ir/api/tools/solana-token?mint=invalid') });
    assert.equal(result.status, 400);
    assert.equal(called, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('token-2022 inspector mode skips expensive holder and metadata calls', async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    let bodyText = '{}';
    if (typeof input === 'object' && input !== null && 'body' in input && (input as Request).body) {
      bodyText = await (input as Request).text();
    } else if (init && init.body) {
      bodyText = String(init.body);
    }
    const body = JSON.parse(bodyText || '{}');
    calls.push(body.method);
    if (body.method === 'getAccountInfo') return response({ result: { context: { slot: 123 }, value: { owner: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1Q9fD7j3Y7h', data: { parsed: { type: 'mint', info: { decimals: 6, supply: '1000000', isInitialized: true, mintAuthority: null, freezeAuthority: null, extensions: [{ type: 'TransferFeeConfig' }] } } } } } });
    throw new Error(`unexpected RPC method: ${body.method}`);
  };
  try {
    const result = await onRequestGet({ request: new Request(`https://solmint.ir/api/tools/solana-token?mode=extensions&mint=${VALID_MINT}`) });
    assert.equal(result.status, 200);
    const body = await result.json() as { ok: boolean; inspector: { isToken2022: boolean; extensions: Array<{ type: string }> } };
    assert.equal(body.ok, true);
    assert.equal(body.inspector.isToken2022, true);
    assert.equal(body.inspector.extensions[0]?.type, 'TransferFeeConfig');
    assert.deepEqual(calls, ['getAccountInfo']);
  } finally { globalThis.fetch = originalFetch; }
});

test('scanner returns JSON 502 instead of throwing when RPC fails', async () => {
  globalThis.fetch = async () => response({ error: { message: 'temporary RPC failure' } }, 503);
  try {
    const result = await onRequestGet({ request: new Request(`https://solmint.ir/api/tools/solana-token?mint=${VALID_MINT}`) });
    assert.equal(result.status, 502);
    const body = await result.json() as { ok: boolean; error: string };
    assert.equal(body.ok, false);
    assert.match(body.error, /Solana/);
  } finally { globalThis.fetch = originalFetch; }
});
