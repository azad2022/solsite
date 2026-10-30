import assert from 'node:assert/strict';
import test from 'node:test';
import { createSolanaRpcProvider } from '../src/pay/services/solanaRpcProvider';

const MAINNET_RPC_URL = process.env.SOLANA_RPC_URL?.trim() || '';
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
  assert.ok(MAINNET_RPC_URL, 'SOLANA_RPC_URL must be explicitly configured for the Mainnet read-only gate');
  assert.ok(MAINNET_RPC_URL.startsWith('https://'), 'Mainnet RPC endpoint must use HTTPS');
  assert.equal(MAINNET_RPC_URL.includes('mainnet'), true, 'read-only gate must target Mainnet');

  const provider = createSolanaRpcProvider({ SOLANA_RPC_URL: MAINNET_RPC_URL });
  const health = await provider.getHealth();
  assert.equal(health.ok, true);
  assert.ok(Number.isSafeInteger(health.slot) && (health.slot ?? 0) > 0);

  const signatures = await rpc<Array<{ signature?: unknown }>>('getSignaturesForAddress', [SYSTEM_PROGRAM, { commitment: 'finalized', limit: 25 }]);
  assert.ok(signatures.length > 0, 'Mainnet RPC must return finalized public transaction signatures');

  // The existing Pay parser explicitly supports legacy and v0 transactions.
  // Newer transaction versions must not be mistaken for an RPC outage or
  // silently forced through a parser that does not support them.
  let signature: string | null = null;
  let observation: Awaited<ReturnType<typeof provider.getTransaction>> = null;
  let unsupportedVersionCount = 0;

  for (const entry of signatures) {
    if (typeof entry.signature !== 'string') continue;
    try {
      const candidate = await provider.getTransaction(entry.signature, 'finalized');
      if (candidate) {
        signature = entry.signature;
        observation = candidate;
        break;
      }
    } catch (error) {
      if (error instanceof Error && /Transaction version \([0-9]+\) is not supported by the requesting client/i.test(error.message)) {
        unsupportedVersionCount += 1;
        continue;
      }
      throw error;
    }
  }

  assert.ok(signature, `Mainnet RPC must expose at least one finalized transaction supported by the current Pay parser (unsupported versions skipped: ${unsupportedVersionCount}).`);
  assert.ok(observation, 'the Pay provider must read the selected Mainnet transaction');
  assert.equal(observation.signature, signature);
  assert.equal(observation?.commitment, 'finalized');
  assert.ok(Number.isSafeInteger(observation?.slot) && (observation?.slot ?? 0) > 0);
  assert.equal(typeof observation?.success, 'boolean');
  assert.ok(Array.isArray(observation?.transfers));
});
