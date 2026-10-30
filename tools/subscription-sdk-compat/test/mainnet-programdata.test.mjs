import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { PublicKey } from '@solana/web3.js';
import {
  assertApprovedMainnetRpcUrl,
  decodeBase64AccountData,
  deriveProgramDataAddress,
  parseProgramDataAccount,
  readProgramDataAddress,
  stripTrailingZeroBytes,
  UPGRADEABLE_LOADER_PROGRAM_ID,
} from '../src/upgradeable-loader.mjs';

const MAINNET_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
const PROGRAM_ID = 'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44';
const RPC_URL = process.env.SOLANA_RPC_URL?.trim() || '';
const EXPECTED_PROGRAM_ELF_SHA256 = process.env.EXPECTED_PROGRAM_ELF_SHA256?.trim() || '';
const ALLOWED_RPC_METHODS = new Set(['getGenesisHash', 'getAccountInfo']);

async function rpc(method, params = []) {
  if (!ALLOWED_RPC_METHODS.has(method)) throw new Error('RPC_METHOD_NOT_ALLOWED');
  let response;
  try {
    response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: method, method, params }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error(`MAINNET_RPC_TRANSPORT_FAILED:${method}`);
  }
  if (!response.ok) throw new Error(`MAINNET_RPC_HTTP_${response.status}:${method}`);
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`MAINNET_RPC_INVALID_JSON:${method}`);
  }
  if (payload?.error) {
    const code = Number.isInteger(payload.error.code) ? payload.error.code : 'UNKNOWN';
    throw new Error(`MAINNET_RPC_ERROR_${code}:${method}`);
  }
  if (!Object.hasOwn(payload ?? {}, 'result')) throw new Error(`MAINNET_RPC_RESULT_MISSING:${method}`);
  return payload.result;
}

test('Mainnet Subscription ProgramData identity is read-only and reproducible', { timeout: 120_000 }, async () => {
  assertApprovedMainnetRpcUrl(RPC_URL);
  assert.match(EXPECTED_PROGRAM_ELF_SHA256, /^[0-9a-f]{64}$/, 'reproducible source-build ELF SHA-256 is required');

  const genesisHash = await rpc('getGenesisHash');
  assert.equal(genesisHash, MAINNET_GENESIS_HASH, 'configured endpoint must be Solana Mainnet');

  const program = new PublicKey(PROGRAM_ID);
  const loaderId = new PublicKey(UPGRADEABLE_LOADER_PROGRAM_ID);
  const programAccount = await rpc('getAccountInfo', [
    program.toBase58(),
    { encoding: 'base64', commitment: 'finalized' },
  ]);
  assert.ok(programAccount?.value, 'pinned Subscription Program account must exist on Mainnet');
  assert.equal(programAccount.value.owner, loaderId.toBase58(), 'Program account must be owned by the Upgradeable BPF Loader');
  assert.equal(programAccount.value.executable, true, 'Subscription Program must be executable');

  const programBytes = decodeBase64AccountData(programAccount.value.data, 'PROGRAM');
  const programDataAddress = readProgramDataAddress(programBytes);
  const derivedProgramDataAddress = deriveProgramDataAddress(PROGRAM_ID);
  assert.equal(programDataAddress, derivedProgramDataAddress, 'Program account pointer must match the loader-derived ProgramData PDA');

  const programDataAccount = await rpc('getAccountInfo', [
    programDataAddress,
    { encoding: 'base64', commitment: 'finalized' },
  ]);
  assert.ok(programDataAccount?.value, 'ProgramData account must exist');
  assert.equal(programDataAccount.value.owner, loaderId.toBase58(), 'ProgramData must be owned by the Upgradeable BPF Loader');
  assert.equal(programDataAccount.value.executable, false, 'ProgramData account must not be executable');

  const programDataBytes = decodeBase64AccountData(programDataAccount.value.data, 'PROGRAM_DATA');
  const parsed = parseProgramDataAccount(programDataBytes);
  // Match solana-verify v0.5.2 get_binary_hash(): trailing zero padding is excluded before SHA-256.
  const executableBytes = stripTrailingZeroBytes(parsed.elfBytes);
  const elfSha256 = createHash('sha256').update(executableBytes).digest('hex');
  assert.equal(elfSha256, EXPECTED_PROGRAM_ELF_SHA256, 'Mainnet deployed ELF must match the reproducible upstream source build');
  const evidence = {
    schemaVersion: 1,
    observedAt: new Date().toISOString(),
    cluster: 'mainnet-beta',
    genesisHash,
    programId: PROGRAM_ID,
    programAccountOwner: programAccount.value.owner,
    programExecutable: programAccount.value.executable,
    programAccountDataLength: programBytes.length,
    programDataAddress,
    programDataOwner: programDataAccount.value.owner,
    programDataExecutable: programDataAccount.value.executable,
    programDataAccountDataLength: programDataBytes.length,
    deploymentSlot: parsed.deploymentSlot,
    upgradeAuthority: parsed.upgradeAuthority,
    elfOffset: parsed.elfOffset,
    programDataExecutableBytesLength: parsed.elfBytes.length,
    elfLength: executableBytes.length,
    trailingZeroPaddingBytes: parsed.elfBytes.length - executableBytes.length,
    elfSha256,
    expectedSourceBuildElfSha256: EXPECTED_PROGRAM_ELF_SHA256,
    commitment: 'finalized',
  };

  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/subscription-mainnet-programdata.json', `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  // This evidence intentionally excludes the RPC URL, API key, and raw ProgramData bytes.
  console.log(JSON.stringify(evidence));
});
