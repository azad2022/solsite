import assert from 'node:assert/strict';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import test from 'node:test';
import { reconcilePayment, type ReconciliationPayment, type ReconciliationRepository } from '../src/pay/services/reconciliationEngine';
import { createSolanaRpcProvider } from '../src/pay/services/solanaRpcProvider';
import type { ObservedPaymentTransaction, ObservedTransfer } from '../src/pay/services/verificationPolicy';

const DEVNET_RPC_URL = process.env.SOLANA_RPC_URL?.trim();
const DEVNET_FUNDER_SECRET_KEY = process.env.DEVNET_E2E_FUNDER_SECRET_KEY_B64?.trim();
if (!DEVNET_RPC_URL) throw new Error('SOLANA_RPC_URL is required for the funded Devnet Payment Intent lifecycle E2E.');
if (!DEVNET_RPC_URL.startsWith('https://')) throw new Error('SOLANA_RPC_URL must use HTTPS for the funded Devnet Payment Intent lifecycle E2E.');
if (!DEVNET_FUNDER_SECRET_KEY) throw new Error('DEVNET_E2E_FUNDER_SECRET_KEY_B64 is required for the funded Devnet Payment Intent lifecycle E2E.');

const EXPECTED_FUNDER_PUBLIC_KEY = 'EZTvPLYyjn6TnXqhiFKw59aqgAPHwxV4qUwhHXctNbXV';
const PAYMENT_AMOUNT_LAMPORTS = 500_000_000n;
const MERCHANT_SETTLEMENT_LAMPORTS = 495_000_000n;
const GATEWAY_FEE_LAMPORTS = 5_000_000n;
// Fund only the payment amount + gateway fee with a small fee buffer; this test does not need an extra reserve.
const FUNDER_TOP_UP_LAMPORTS = 510_000_000n;
const MIN_FUNDER_BALANCE_LAMPORTS = FUNDER_TOP_UP_LAMPORTS + 100_000n;
const OBSERVATION_POLL_ATTEMPTS = 20;
const OBSERVATION_POLL_DELAY_MS = 2_000;
const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
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

function decodeFunderSecret(value: string): Uint8Array {
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

function createFunder(): Keypair {
  return Keypair.fromSecretKey(decodeFunderSecret(DEVNET_FUNDER_SECRET_KEY));
}

function createMemoInstruction(reference: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM,
    keys: [{ pubkey: reference, isSigner: true, isWritable: false }],
    data: Buffer.from(`solmint-pay-intent:${reference.toBase58()}`, 'utf8'),
  });
}

async function confirmFinalized(connection: Connection, signature: string, blockhash: string, lastValidBlockHeight: number): Promise<void> {
  const confirmation = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'finalized');
  if (confirmation.value.err) throw new Error(`Devnet transaction failed: ${JSON.stringify(confirmation.value.err)}`);
}

async function fundPayer(connection: Connection, funder: Keypair, payer: Keypair): Promise<void> {
  const balance = await connection.getBalance(funder.publicKey, 'finalized');
  if (balance < Number(MIN_FUNDER_BALANCE_LAMPORTS)) throw new Error('Devnet funding account has insufficient SOL for the Payment Intent lifecycle E2E.');
  const latest = await connection.getLatestBlockhash('finalized');
  const transaction = new Transaction({ feePayer: funder.publicKey, recentBlockhash: latest.blockhash }).add(
    SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: payer.publicKey, lamports: Number(FUNDER_TOP_UP_LAMPORTS) }),
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

class MemoryReconciliationRepository implements ReconciliationRepository {
  readonly knownSignatures = new Set<string>();
  readonly rejected: Array<{ signature: string; reason: string }> = [];
  readonly applied: Array<{ signature: string; status: string }> = [];
  status: ReconciliationPayment['status'];

  constructor(initialStatus: ReconciliationPayment['status']) {
    this.status = initialStatus;
  }

  async loadKnownSignatures(): Promise<ReadonlySet<string>> {
    return new Set(this.knownSignatures);
  }

  async prepareVerification(): Promise<'ready' | 'stale'> {
    this.status = 'pending';
    return 'ready';
  }

  async recordRejectedObservation(_paymentId: string, observation: ObservedPaymentTransaction, reason: string): Promise<void> {
    this.rejected.push({ signature: observation.signature, reason });
  }

  async recordOutcome(_paymentId: string, status: 'underpaid' | 'overpaid' | 'ambiguous' | 'failed' | 'wrong_recipient'): Promise<'recorded' | 'stale'> {
    this.status = status;
    return 'recorded';
  }

  async applyVerifiedObservation(input: { payment: ReconciliationPayment; observation: ObservedPaymentTransaction; transfers: readonly ObservedTransfer[] }): Promise<'confirmed' | 'duplicate' | 'stale'> {
    if (this.knownSignatures.has(input.observation.signature)) return 'duplicate';
    this.knownSignatures.add(input.observation.signature);
    this.status = 'confirmed';
    this.applied.push({ signature: input.observation.signature, status: 'confirmed' });
    assert.equal(input.transfers.filter((transfer) => transfer.role === 'merchant_settlement').length, 1);
    assert.equal(input.transfers.filter((transfer) => transfer.role === 'gateway_fee').length, 1);
    return 'confirmed';
  }

  async expirePayment(): Promise<'expired' | 'stale'> {
    this.status = 'expired';
    return 'expired';
  }
}

test('SolMint Pay Payment Intent reconciliation verifies a real Devnet transaction and rejects replay', { timeout: 300_000 }, async () => {
  const connection = new Connection(DEVNET_RPC_URL, { commitment: 'confirmed' });
  const funder = createFunder();
  assert.equal(funder.publicKey.toBase58(), EXPECTED_FUNDER_PUBLIC_KEY, 'Devnet E2E funder secret must match the documented CI wallet.');

  const payer = Keypair.generate();
  const merchant = Keypair.generate();
  const feeRecipient = Keypair.generate();
  const reference = Keypair.generate();
  await fundPayer(connection, funder, payer);

  const latest = await connection.getLatestBlockhash('finalized');
  const transaction = new Transaction({ feePayer: payer.publicKey, recentBlockhash: latest.blockhash })
    .add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: merchant.publicKey, lamports: Number(MERCHANT_SETTLEMENT_LAMPORTS) }))
    .add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: feeRecipient.publicKey, lamports: Number(GATEWAY_FEE_LAMPORTS) }))
    .add(createMemoInstruction(reference.publicKey));
  transaction.sign(payer, reference);

  const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 2 });
  await confirmFinalized(connection, signature, latest.blockhash, latest.lastValidBlockHeight);

  const provider = createSolanaRpcProvider({ SOLANA_RPC_URL: DEVNET_RPC_URL });
  const observation = await waitForFinalizedObservation(provider, signature);
  assert.equal(observation.success, true);

  const createdAt = new Date(Date.now() - 2 * 60_000).toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const payment: ReconciliationPayment = {
    id: crypto.randomUUID(),
    merchantId: crypto.randomUUID(),
    createdAt,
    amountAtomic: PAYMENT_AMOUNT_LAMPORTS.toString(),
    customerTotalAtomic: PAYMENT_AMOUNT_LAMPORTS.toString(),
    merchantSettlementAtomic: MERCHANT_SETTLEMENT_LAMPORTS.toString(),
    gatewayFeeAtomic: GATEWAY_FEE_LAMPORTS.toString(),
    asset: 'SOL',
    tokenMint: null,
    tokenProgram: null,
    tokenDecimals: null,
    recipient: merchant.publicKey.toBase58(),
    feeRecipient: feeRecipient.publicKey.toBase58(),
    reference: reference.publicKey.toBase58(),
    verificationCommitment: 'finalized',
    expiresAt,
    status: 'pending',
  };

  const repository = new MemoryReconciliationRepository(payment.status);
  const first = await reconcilePayment(provider, repository, payment, signature);
  assert.equal(first.outcome, 'confirmed');
  assert.equal(first.verification?.result.reason, 'OK');
  assert.equal(first.verification?.result.status, 'confirmed');
  assert.equal(repository.status, 'confirmed');
  assert.deepEqual(repository.applied, [{ signature, status: 'confirmed' }]);

  const replay = await reconcilePayment(provider, repository, { ...payment, status: 'confirmed' }, signature);
  assert.equal(replay.outcome, 'duplicate');
  assert.equal(replay.verification?.result.reason, 'DUPLICATE_SIGNATURE');
  assert.equal(repository.applied.length, 1);

  const window = { createdAt, expiresAt };
  const discovered = await provider.findTransactionsByReference(reference.publicKey.toBase58(), 'finalized', window);
  assert.ok(discovered.some((candidate) => candidate.signature === signature));
  assert.equal(PAYMENT_AMOUNT_LAMPORTS, MERCHANT_SETTLEMENT_LAMPORTS + GATEWAY_FEE_LAMPORTS);
  assert.equal(observation.commitment, 'finalized');
});
