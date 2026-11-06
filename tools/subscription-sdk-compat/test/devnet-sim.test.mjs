import assert from 'node:assert/strict';
import test from 'node:test';
import { address, createNoopSigner } from '@solana/kit';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getCreatePlanOverlayInstructionAsync } from '@solana/subscriptions';
import { kitInstructionToWeb3 } from '../dist/kit-to-web3.js';

const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const PROGRAM_ID = 'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44';
const DEVNET_SIMULATION_FEE_PAYER = 'EZTvPLYyjn6TnXqhiFKw59aqgAPHwxV4qUwhHXctNbXV';
const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112';
const SPL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
// Pinned program-v0.5.0 Plan::LEN / PLAN_LEN_V1 from program/src/state/plan.rs.
const PLAN_ACCOUNT_BYTES = 491;
const ALLOWED_RPC_METHODS = new Set([
  'getGenesisHash',
  'getAccountInfo',
  'getBalance',
  'getMinimumBalanceForRentExemption',
  'getLatestBlockhash',
  'simulateTransaction',
]);

const rpcUrl = process.env.SOLANA_DEVNET_RPC_URL?.trim();
if (!rpcUrl) throw new Error('SOLANA_DEVNET_RPC_URL is required for non-mutating Subscription simulation.');
if (!rpcUrl.startsWith('https://')) throw new Error('SOLANA_DEVNET_RPC_URL must use HTTPS.');

let requestId = 0;
async function rpc(method, params = []) {
  if (!ALLOWED_RPC_METHODS.has(method)) throw new Error('RPC_METHOD_NOT_ALLOWED');
  let response;
  try {
    response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error(`RPC_TRANSPORT_FAILED:${method}`);
  }
  if (!response.ok) throw new Error(`RPC_HTTP_${response.status}:${method}`);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`RPC_INVALID_JSON:${method}`);
  }
  if (payload?.error) {
    const code = Number.isInteger(payload.error.code) ? payload.error.code : 'UNKNOWN';
    throw new Error(`RPC_ERROR_${code}:${method}`);
  }
  if (!Object.hasOwn(payload ?? {}, 'result')) throw new Error(`RPC_RESULT_MISSING:${method}`);
  return payload.result;
}

test('pinned Subscription Program is executable on Devnet and CreatePlan simulates without submission', { timeout: 90_000 }, async () => {
  const genesisHash = await rpc('getGenesisHash');
  assert.equal(genesisHash, DEVNET_GENESIS_HASH, 'configured endpoint must be Solana Devnet');

  const programAccount = await rpc('getAccountInfo', [
    PROGRAM_ID,
    { encoding: 'base64', commitment: 'finalized' },
  ]);
  assert.ok(programAccount?.value, 'pinned Subscription Program account must exist on Devnet');
  assert.equal(programAccount.value.executable, true, 'pinned Subscription Program must be executable');
  assert.equal(
    programAccount.value.owner,
    'BPFLoaderUpgradeab1e11111111111111111111111',
    'pinned Program must be owned by the Upgradeable BPF Loader',
  );

  const feePayer = new PublicKey(DEVNET_SIMULATION_FEE_PAYER);
  const [balanceResult, rentResult, blockhashResult] = await Promise.all([
    rpc('getBalance', [feePayer.toBase58(), { commitment: 'finalized' }]),
    rpc('getMinimumBalanceForRentExemption', [PLAN_ACCOUNT_BYTES, { commitment: 'confirmed' }]),
    rpc('getLatestBlockhash', [{ commitment: 'confirmed' }]),
  ]);
  assert.ok(Number.isSafeInteger(balanceResult?.value) && balanceResult.value > 0, 'Devnet simulation fee payer must have a readable positive balance');
  assert.ok(Number.isSafeInteger(rentResult) && rentResult > 0, 'Plan rent requirement must be available from RPC');
  assert.ok(balanceResult.value >= rentResult + 2_000_000, 'Devnet simulation fee payer balance must cover the simulated Plan allocation and fee buffer');
  assert.ok(typeof blockhashResult?.value?.blockhash === 'string', 'Devnet must return a recent blockhash');

  const merchant = address(feePayer.toBase58());
  const instruction = await getCreatePlanOverlayInstructionAsync({
    owner: createNoopSigner(merchant),
    planId: 7_301_030n,
    mint: address(WRAPPED_SOL_MINT),
    amount: 1_250_000n,
    periodHours: 720n,
    endTs: 0n,
    destinations: [merchant],
    pullers: [],
    metadataUri: 'https://solmint.ir/subscription-devnet-sim.json',
    tokenProgram: address(SPL_TOKEN_PROGRAM),
  });
  assert.equal(instruction.programAddress, PROGRAM_ID);

  const converted = kitInstructionToWeb3(instruction);
  assert.equal(converted.programId.toBase58(), PROGRAM_ID);
  const transaction = new Transaction({
    feePayer,
    recentBlockhash: blockhashResult.value.blockhash,
  }).add(converted);

  // The transaction deliberately has no signature. sigVerify=false is required
  // for simulation and is not a signing or submission operation.
  const wire = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  const simulation = await rpc('simulateTransaction', [
    wire.toString('base64'),
    {
      encoding: 'base64',
      commitment: 'confirmed',
      sigVerify: false,
      replaceRecentBlockhash: true,
    },
  ]);

  assert.equal(simulation?.value?.err, null, 'CreatePlan must execute successfully in the Devnet simulator');
  assert.ok(Number.isSafeInteger(simulation.value.unitsConsumed) && simulation.value.unitsConsumed > 0, 'simulation must report non-zero compute consumption');
  assert.ok(
    Array.isArray(simulation.value.logs) &&
    simulation.value.logs.some(line => line.includes(`Program ${PROGRAM_ID} success`)),
    'simulation logs must contain successful execution of the pinned Subscription Program',
  );
  // Only these read-only RPC methods are permitted in this test. There is no
  // sendTransaction/sendRawTransaction call, signer invocation or key material.
});
