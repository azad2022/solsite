import assert from 'node:assert/strict';
import { Keypair, Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import test from 'node:test';
import { createSolanaRpcProvider } from '../src/pay/services/solanaRpcProvider';
import { verifyPayment } from '../src/pay/services/paymentVerifier';
import type { ExpectedPayment } from '../src/pay/services/verificationPolicy';

const DEVNET_RPC_URL = process.env.SOLANA_RPC_URL?.trim();
const DEVNET_FUNDER_SECRET_KEY = process.env.DEVNET_E2E_FUNDER_SECRET_KEY_B64?.trim();
if (!DEVNET_RPC_URL) throw new Error('SOLANA_RPC_URL is required for the funded Devnet E2E.');
if (!DEVNET_RPC_URL.startsWith('https://')) throw new Error('SOLANA_RPC_URL must use HTTPS for the funded Devnet E2E.');
if (!DEVNET_FUNDER_SECRET_KEY) throw new Error('DEVNET_E2E_FUNDER_SECRET_KEY_B64 is required for Devnet test-account provisioning.');

const SYSTEM_PROGRAM = new PublicKey('11111111111111111111111111111111');
const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const EXPECTED_FUNDER_PUBLIC_KEY = new PublicKey('EZTvPLYyjn6TnXqhiFKw59aqgAPHwxV4qUwhHXctNbXV');
const PAYMENT_AMOUNT_LAMPORTS = 500_000_000;
const MERCHANT_SETTLEMENT_LAMPORTS = 495_000_000;
const GATEWAY_FEE_LAMPORTS = 5_000_000;
const FUNDER_TOP_UP_LAMPORTS = 520_000_000;
const MIN_FUNDER_BALANCE_LAMPORTS = FUNDER_TOP_UP_LAMPORTS + 100_000_000;
const OBSERVATION_POLL_ATTEMPTS = 20;
const OBSERVATION_POLL_DELAY_MS = 2_000;
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((char, index) => [char, index]));

function decodeBase58(value: string): Buffer {
  let result = 0n;
  for (const char of value) {
    const index = BASE58_INDEX.get(char);
    if (index === undefined) throw new Error('Invalid Base58 key material.');
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

function decodeFunderSecret(value: string): Buffer {
  const candidates: Buffer[] = [];
  const base64 = Buffer.from(value, 'base64');
  if (base64.length === 64) candidates.push(base64);
  try {
    const base58 = decodeBase58(value);
    if (base58.length === 64) candidates.push(base58);
  } catch {}
  for (const candidate of candidates) {
    try {
      const keypair = Keypair.fromSecretKey(candidate);
      if (Buffer.from(candidate.subarray(32)).equals(Buffer.from(keypair.publicKey.toBytes()))) return candidate;
    } catch {}
  }
  throw new Error('DEVNET_E2E_FUNDER_SECRET_KEY_B64 must contain a valid 64-byte Solana keypair encoded as Base64 or Base58.');
}

function createDevnetFunder(): Keypair {
  return Keypair.fromSecretKey(decodeFunderSecret(DEVNET_FUNDER_SECRET_KEY));
}

function createMemoInstruction(reference: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM,
    keys: [{ pubkey: reference, isSigner: true, isWritable: false }],
    data: Buffer.from(`solmint-pay-devnet:${reference.toBase58()}`, 'utf8'),
  });
}

async function confirmFinalized(connection: Connection, signature: string, blockhash: string, lastValidBlockHeight: number): Promise<void> {
  const confirmation = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'finalized');
  if (confirmation.value.err) throw new Error(`Devnet transaction failed: ${JSON.stringify(confirmation.value.err)}`);
}

async function fundPayer(connection: Connection, funder: Keypair, payer: Keypair): Promise<void> {
  const balance = await connection.getBalance(funder.publicKey, 'finalized');
  if (balance < MIN_FUNDER_BALANCE_LAMPORTS) throw new Error('Devnet funding account has insufficient SOL for the real-payment E2E.');
  const latest = await connection.getLatestBlockhash('finalized');
  const transaction = new Transaction({ feePayer: funder.publicKey, recentBlockhash: latest.blockhash }).add(
    SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: payer.publicKey, lamports: FUNDER_TOP_UP_LAMPORTS }),
  );
  transaction.sign(funder);
  const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 2 });
  await confirmFinalized(connection, signature, latest.blockhash, latest.lastValidBlockHeight);
}

async function waitForFinalizedObservation(
  provider: ReturnType<typeof createSolanaRpcProvider>,
  signature: string,
): Promise<NonNullable<Awaited<ReturnType<typeof provider.getTransaction>>>> {
  for (let attempt = 1; attempt <= OBSERVATION_POLL_ATTEMPTS; attempt += 1) {
    const observation = await provider.getTransaction(signature, 'finalized');
    if (observation) return observation;
    if (attempt < OBSERVATION_POLL_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, OBSERVATION_POLL_DELAY_MS));
  }
  throw new Error(`FINALIZED_TRANSACTION_OBSERVATION_TIMEOUT after ${OBSERVATION_POLL_ATTEMPTS} attempts`);
}

test('SolMint Pay verification discovers and verifies a real Devnet SOL payment', { timeout: 270_000 }, async () => {
  const connection = new Connection(DEVNET_RPC_URL, { commitment: 'confirmed' });
  const payer = Keypair.generate();
  const merchant = Keypair.generate();
  const fee = Keypair.generate();
  const reference = Keypair.generate();
  const funder = createDevnetFunder();

  assert.equal(funder.publicKey.toBase58(), EXPECTED_FUNDER_PUBLIC_KEY.toBase58(), 'Devnet E2E funder secret must match the documented CI wallet.');
  await fundPayer(connection, funder, payer);

  const latest = await connection.getLatestBlockhash('finalized');
  const payment = new Transaction({ feePayer: payer.publicKey, recentBlockhash: latest.blockhash })
    .add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: merchant.publicKey, lamports: MERCHANT_SETTLEMENT_LAMPORTS }))
    .add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: fee.publicKey, lamports: GATEWAY_FEE_LAMPORTS }))
    .add(createMemoInstruction(reference.publicKey));
  payment.sign(payer, reference);

  const signature = await connection.sendRawTransaction(payment.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 2 });
  await confirmFinalized(connection, signature, latest.blockhash, latest.lastValidBlockHeight);

  const provider = createSolanaRpcProvider({ SOLANA_RPC_URL: DEVNET_RPC_URL });
  const directObservation = await waitForFinalizedObservation(provider, signature);
  assert.equal(directObservation.success, true);

  const window = { createdAt: new Date(Date.now() - 5 * 60_000).toISOString(), expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
  const discovered = await provider.findTransactionsByReference(reference.publicKey.toBase58(), 'finalized', window);
  assert.ok(discovered.some((observation) => observation.signature === signature), 'the real transaction must be discoverable through its Pay reference');

  const expected: ExpectedPayment = {
    amountAtomic: PAYMENT_AMOUNT_LAMPORTS.toString(),
    asset: 'SOL',
    tokenMint: null,
    tokenProgram: null,
    tokenDecimals: null,
    merchantDestination: merchant.publicKey.toBase58(),
    feeDestination: fee.publicKey.toBase58(),
    merchantSettlementAtomic: MERCHANT_SETTLEMENT_LAMPORTS.toString(),
    gatewayFeeAtomic: GATEWAY_FEE_LAMPORTS.toString(),
    reference: reference.publicKey.toBase58(),
    requiredCommitment: 'finalized',
  };

  const decision = await verifyPayment(provider, expected, signature, new Set(), window);
  assert.equal(decision.result.valid, true);
  assert.equal(decision.result.reason, 'OK');
  assert.equal(decision.result.status, 'confirmed');
  assert.equal(decision.candidate?.signature, signature);
  assert.equal(SYSTEM_PROGRAM.toBase58(), '11111111111111111111111111111111');
});
