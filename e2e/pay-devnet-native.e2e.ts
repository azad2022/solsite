import assert from 'node:assert/strict';
import { Keypair, Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import test from 'node:test';
import { createSolanaRpcProvider } from '../src/pay/services/solanaRpcProvider';
import { verifyPayment } from '../src/pay/services/paymentVerifier';
import type { ExpectedPayment } from '../src/pay/services/verificationPolicy';

const DEVNET_RPC_URL = process.env.SOLANA_RPC_URL?.trim();
const DEVNET_FUNDER_SECRET_KEY_B64 = process.env.DEVNET_E2E_FUNDER_SECRET_KEY_B64?.trim();
if (!DEVNET_RPC_URL) throw new Error('SOLANA_RPC_URL is required for the funded Devnet E2E; configure a dedicated Devnet RPC endpoint.');
if (!DEVNET_RPC_URL.startsWith('https://')) throw new Error('SOLANA_RPC_URL must use HTTPS for the funded Devnet E2E.');
if (!DEVNET_FUNDER_SECRET_KEY_B64) throw new Error('DEVNET_E2E_FUNDER_SECRET_KEY_B64 is required for Devnet test-account provisioning.');

const SYSTEM_PROGRAM = new PublicKey('11111111111111111111111111111111');
const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const PAYMENT_AMOUNT_LAMPORTS = 500_000_000;
const MERCHANT_SETTLEMENT_LAMPORTS = 495_000_000;
const GATEWAY_FEE_LAMPORTS = 5_000_000;
const FUNDER_TOP_UP_LAMPORTS = 520_000_000;
const MIN_FUNDER_BALANCE_LAMPORTS = FUNDER_TOP_UP_LAMPORTS + 100_000_000;
const TIMEOUT_MS = 90_000;

function createDevnetFunder(): Keypair {
  const secretKey = Buffer.from(DEVNET_E2E_FUNDER_SECRET_KEY_B64, 'base64');
  if (secretKey.length !== 64) throw new Error('DEVNET_E2E_FUNDER_SECRET_KEY_B64 must contain exactly 64 raw Solana keypair bytes encoded as Base64.');
  return Keypair.fromSecretKey(secretKey);
}

function createMemoInstruction(reference: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM,
    keys: [{ pubkey: reference, isSigner: false, isWritable: false }],
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

test('SolMint Pay verification discovers and verifies a real Devnet SOL payment', { timeout: TIMEOUT_MS * 2 + 180_000 }, async () => {
  const connection = new Connection(DEVNET_RPC_URL, { commitment: 'confirmed' });
  const payer = Keypair.generate();
  const merchant = Keypair.generate();
  const fee = Keypair.generate();
  const reference = Keypair.generate();
  const funder = createDevnetFunder();

  await fundPayer(connection, funder, payer);

  const latest = await connection.getLatestBlockhash('finalized');
  const payment = new Transaction({ feePayer: payer.publicKey, recentBlockhash: latest.blockhash })
    .add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: merchant.publicKey, lamports: MERCHANT_SETTLEMENT_LAMPORTS }))
    .add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: fee.publicKey, lamports: GATEWAY_FEE_LAMPORTS }))
    .add(createMemoInstruction(reference.publicKey));
  payment.sign(payer);

  const signature = await connection.sendRawTransaction(payment.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 2 });
  await confirmFinalized(connection, signature, latest.blockhash, latest.lastValidBlockHeight);

  const provider = createSolanaRpcProvider({ SOLANA_RPC_URL: DEVNET_RPC_URL });
  const directObservation = await provider.getTransaction(signature, 'finalized');
  assert.ok(directObservation, 'the real Devnet transaction must be readable by the Pay provider');
  assert.equal(directObservation?.success, true);

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

  // Keep the System Program constant exercised by the real transaction path.
  assert.equal(SYSTEM_PROGRAM.toBase58(), '11111111111111111111111111111111');
});