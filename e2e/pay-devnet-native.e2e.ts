import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import { createSolanaRpcProvider } from '../src/pay/services/solanaRpcProvider';
import { verifyPayment } from '../src/pay/services/paymentVerifier';
import type { ExpectedPayment } from '../src/pay/services/verificationPolicy';

const DEVNET_RPC_URL = process.env.SOLANA_RPC_URL?.trim() || 'https://api.devnet.solana.com';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const PAYMENT_AMOUNT_LAMPORTS = 1_000_000_000n;
const MERCHANT_SETTLEMENT_LAMPORTS = 990_000_000n;
const GATEWAY_FEE_LAMPORTS = 10_000_000n;
const AIRDROP_LAMPORTS = 1_500_000_000;
const TIMEOUT_MS = 90_000;
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((char, index) => [char, index]));

function base58Encode(bytes: Uint8Array): string {
  let value = BigInt(`0x${Buffer.from(bytes).toString('hex') || '0'}`);
  let output = '';
  while (value > 0n) {
    const remainder = Number(value % 58n);
    output = BASE58_ALPHABET[remainder] + output;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    output = `1${output}`;
  }
  return output || '1';
}

function base58Decode(value: string): Buffer {
  let result = 0n;
  for (const char of value) {
    const index = BASE58_INDEX.get(char);
    if (index === undefined) throw new Error(`Invalid base58 character: ${char}`);
    result = result * 58n + BigInt(index);
  }
  let hex = result.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const decoded = hex ? Buffer.from(hex, 'hex') : Buffer.alloc(0);
  let leadingZeros = 0;
  for (const char of value) {
    if (char !== '1') break;
    leadingZeros += 1;
  }
  return Buffer.concat([Buffer.alloc(leadingZeros), decoded]);
}

function compactU16(value: number): Buffer {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new Error('Invalid compact-u16 value.');
  const bytes: number[] = [];
  let remaining = value;
  while (remaining >= 0x80) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining >>>= 7;
  }
  bytes.push(remaining);
  return Buffer.from(bytes);
}

function u32le(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value, 0);
  return buffer;
}

function u64le(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value, 0);
  return buffer;
}

function rawPublicKey(key: ReturnType<typeof generateKeyPairSync>['publicKey']): Buffer {
  const der = key.export({ type: 'spki', format: 'der' });
  return Buffer.from(der.subarray(-32));
}

function createKeypair() {
  const keypair = generateKeyPairSync('ed25519');
  const publicKey = rawPublicKey(keypair.publicKey);
  return { ...keypair, publicKey, address: base58Encode(publicKey) };
}

function compiledInstruction(programIdIndex: number, accountIndices: number[], data: Buffer): Buffer {
  return Buffer.concat([Buffer.from([programIdIndex]), compactU16(accountIndices.length), Buffer.from(accountIndices), compactU16(data.length), data]);
}

function systemTransfer(fromIndex: number, toIndex: number, amount: bigint): Buffer {
  return compiledInstruction(4, [fromIndex, toIndex], Buffer.concat([u32le(2), u64le(amount)]));
}

function memoInstruction(referenceIndex: number, data: Buffer): Buffer {
  return compiledInstruction(5, [referenceIndex], data);
}

function buildLegacyMessage(payer: Buffer, merchant: Buffer, fee: Buffer, reference: Buffer, recentBlockhash: Buffer): Buffer {
  const accountKeys = [payer, merchant, fee, reference, base58Decode(SYSTEM_PROGRAM), base58Decode(MEMO_PROGRAM)];
  const memoData = Buffer.from(`solmint-pay-devnet:${base58Encode(reference)}`, 'utf8');
  const instructions = [
    systemTransfer(0, 1, MERCHANT_SETTLEMENT_LAMPORTS),
    systemTransfer(0, 2, GATEWAY_FEE_LAMPORTS),
    memoInstruction(3, memoData),
  ];
  return Buffer.concat([Buffer.from([1, 0, 3]), compactU16(accountKeys.length), ...accountKeys, recentBlockhash, compactU16(instructions.length), ...instructions]);
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(DEVNET_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
  });
  if (!response.ok) throw new Error(`Devnet RPC HTTP ${response.status}`);
  const payload = await response.json() as { result?: T; error?: { code?: number; message?: string } };
  if (payload.error) throw new Error(`Devnet RPC ${payload.error.message || payload.error.code || 'error'}`);
  if (payload.result === undefined) throw new Error(`Devnet RPC ${method} returned no result`);
  return payload.result;
}

async function waitForFinalized(signature: string): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const statuses = await rpc<Array<{ confirmationStatus?: string | null; err?: unknown } | null>>('getSignatureStatuses', [[signature], { searchTransactionHistory: true }]);
    const status = statuses[0];
    if (status?.err) throw new Error(`Devnet transaction failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === 'finalized') return;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error(`Timed out waiting for finalized transaction ${signature}`);
}

async function retryAirdrop(address: string): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const signature = await rpc<string>('requestAirdrop', [address, AIRDROP_LAMPORTS]);
      await waitForFinalized(signature);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 6) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  throw new Error(`Devnet faucet unavailable after retries: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

test('SolMint Pay verification discovers and verifies a real Devnet SOL payment', { timeout: TIMEOUT_MS * 2 + 30_000 }, async () => {
  const payer = createKeypair();
  const merchant = createKeypair();
  const fee = createKeypair();
  const reference = createKeypair();

  await retryAirdrop(payer.address);

  const latest = await rpc<{ blockhash: string }>('getLatestBlockhash', [{ commitment: 'finalized' }]);
  const message = buildLegacyMessage(payer.publicKey, merchant.publicKey, fee.publicKey, reference.publicKey, base58Decode(latest.blockhash));
  const signatureBytes = sign(null, message, payer.privateKey);
  const wireTransaction = Buffer.concat([compactU16(1), Buffer.from(signatureBytes), message]);
  const signature = await rpc<string>('sendTransaction', [wireTransaction.toString('base64'), { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed' }]);
  assert.ok(signature);
  await waitForFinalized(signature);

  const provider = createSolanaRpcProvider({ SOLANA_RPC_URL: DEVNET_RPC_URL });
  const directObservation = await provider.getTransaction(signature, 'finalized');
  assert.ok(directObservation, 'the real Devnet transaction must be readable by the Pay provider');
  assert.equal(directObservation?.success, true);

  const window = {
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  };
  const discovered = await provider.findTransactionsByReference(reference.address, 'finalized', window);
  assert.ok(discovered.some((observation) => observation.signature === signature), 'the real transaction must be discoverable through its Pay reference');

  const expected: ExpectedPayment = {
    amountAtomic: PAYMENT_AMOUNT_LAMPORTS.toString(),
    asset: 'SOL',
    tokenMint: null,
    tokenProgram: null,
    tokenDecimals: null,
    merchantDestination: merchant.address,
    feeDestination: fee.address,
    merchantSettlementAtomic: MERCHANT_SETTLEMENT_LAMPORTS.toString(),
    gatewayFeeAtomic: GATEWAY_FEE_LAMPORTS.toString(),
    reference: reference.address,
    requiredCommitment: 'finalized',
  };

  const decision = await verifyPayment(provider, expected, signature, new Set(), window);
  assert.equal(decision.result.valid, true);
  assert.equal(decision.result.reason, 'OK');
  assert.equal(decision.result.status, 'confirmed');
  assert.equal(decision.candidate?.signature, signature);
});
