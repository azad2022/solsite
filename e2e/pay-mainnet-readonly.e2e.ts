import assert from 'node:assert/strict';
import test from 'node:test';
import { createSolanaRpcProvider } from '../src/pay/services/solanaRpcProvider';

const MAINNET_RPC_URL = process.env.SOLANA_RPC_URL?.trim() || 'https://api.mainnet-beta.solana.com';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const RPC_TIMEOUT_MS = 15_000;

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const response = await fetch(MAINNET_RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Mainnet RPC HTTP ${response.status}`);
    const payload = await response.json() as { result?: T; error?: { code?: number; message?: string } };
    if (payload.error) throw new Error(`Mainnet RPC ${payload.error.message || payload.error.code || 'error'}`);
    if (payload.result === undefined) throw new Error(`Mainnet RPC ${method} returned no result`);
    return payload.result;
  } finally {
    clearTimeout(timer);
  }
}

test('SolMint Pay reads and normalizes a live finalized Mainnet transaction without mutating the chain', { timeout: 45_000 }, async () => {
  assert.equal(MAINNET_RPC_URL.includes('mainnet'), true, 'read-only gate must target Mainnet');

  const provider = createSolanaRpcProvider({ SOLANA_RPC_URL: MAINNET_RPC_URL });
  const health = await provider.getHealth();
  assert.equal(health.ok, true);
  assert.ok(Number.isSafeInteger(health.slot) && (health.slot ?? 0) > 0);

  const signatures = await rpc<Array<{ signature?: unknown }>>('getSignaturesForAddress', [SYSTEM_PROGRAM, { commitment: 'finalized', limit: 1 }]);
  const signature = typeof signatures[0]?.signature === 'string' ? signatures[0].signature : null;
  assert.ok(signature, 'Mainnet RPC must return a finalized public transaction signature');

  const observation = await provider.getTransaction(signature!, 'finalized');
  assert.ok(observation, 'the Pay provider must read the selected Mainnet transaction');
  assert.equal(observation?.signature, signature);
  assert.equal(observation?.commitment, 'finalized');
  assert.ok(Number.isSafeInteger(observation?.slot) && (observation?.slot ?? 0) > 0);
  assert.equal(typeof observation?.success, 'boolean');
  assert.ok(Array.isArray(observation?.transfers));
});
