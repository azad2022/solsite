import assert from 'node:assert/strict';
import test from 'node:test';
import { Keypair, Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { createSolanaRpcProvider } from '../src/pay/services/solanaRpcProvider';
import { verifyPayment } from '../src/pay/services/paymentVerifier';
import { reconcilePayment, type ReconciliationPayment, type ReconciliationRepository } from '../src/pay/services/reconciliationEngine';
import type { ExpectedPayment } from '../src/pay/services/verificationPolicy';
import { buildTransaction, type PaymentRow } from '../functions/api/pay/v1/payment-intents/[id]/transaction-request';

const DEVNET_RPC_URL = process.env.SOLANA_RPC_URL?.trim();
const DEVNET_FUNDER_SECRET = process.env.DEVNET_E2E_FUNDER_SECRET_KEY_B64?.trim();
if (!DEVNET_RPC_URL) throw new Error('SOLANA_RPC_URL is required for hosted transaction Devnet E2E.');
if (!DEVNET_RPC_URL.startsWith('https://')) throw new Error('SOLANA_RPC_URL must use HTTPS.');
if (!DEVNET_FUNDER_SECRET) throw new Error('DEVNET_E2E_FUNDER_SECRET_KEY_B64 is required.');

const EXPECTED_FUNDER = new PublicKey('EZTvPLYyjn6TnXqhiFKw59aqgAPHwxV4qUwhHXctNbXV');
const PAYMENT_AMOUNT = 2_000_000n;
const FEE = 10_000n;
const SETTLEMENT = PAYMENT_AMOUNT - FEE;
const TOP_UP = Number(PAYMENT_AMOUNT + 1_000_000n);
const MIN_FUNDER_BALANCE = TOP_UP + 100_000;

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_INDEX = new Map([...BASE58].map((char, index) => [char, index]));

function decodeBase58(value: string): Buffer {
  let result = 0n;
  for (const char of value) {
    const index = BASE58_INDEX.get(char);
    if (index === undefined) throw new Error('Invalid Base58 funder secret.');
    result = result * 58n + BigInt(index);
  }
  let hex = result.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const decoded = hex ? Buffer.from(hex, 'hex') : Buffer.alloc(0);
  let leadingZeros = 0;
  for (const char of value) {
    if (char !== '1') break;
    leadingZeros += 1;
  }
  return Buffer.concat([Buffer.alloc(leadingZeros), decoded]);
}

function loadFunder(value: string): Keypair {
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
      if (Buffer.from(candidate.subarray(32)).equals(Buffer.from(keypair.publicKey.toBytes()))) return keypair;
    } catch {}
  }
  throw new Error('DEVNET_E2E_FUNDER_SECRET_KEY_B64 must contain a valid 64-byte Solana keypair.');
}

async function confirm(connection: Connection, signature: string, blockhash: string, lastValidBlockHeight: number): Promise<void> {
  const result = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'finalized');
  assert.equal(result.value.err, null);
}

test('hosted transaction builder produces a real discoverable Devnet payment', { timeout: 300_000 }, async () => {
  const connection = new Connection(DEVNET_RPC_URL, 'confirmed');
  const funder = loadFunder(DEVNET_FUNDER_SECRET);
  assert.equal(funder.publicKey.toBase58(), EXPECTED_FUNDER.toBase58());

  const funderBalance = await connection.getBalance(funder.publicKey, 'finalized');
  assert.ok(funderBalance >= MIN_FUNDER_BALANCE, 'Devnet funder balance is too low for hosted transaction E2E.');

  const payer = Keypair.generate();
  const merchant = Keypair.generate();
  const feeRecipient = EXPECTED_FUNDER;
  const reference = Keypair.generate();

  const fundingBlockhash = await connection.getLatestBlockhash('finalized');
  const fundingTx = new Transaction({
    feePayer: funder.publicKey,
    recentBlockhash: fundingBlockhash.blockhash,
  }).add(
    SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: payer.publicKey, lamports: TOP_UP }),
  );
  fundingTx.sign(funder);
  const fundingSignature = await connection.sendRawTransaction(fundingTx.serialize(), { skipPreflight: false, maxRetries: 2 });
  await confirm(connection, fundingSignature, fundingBlockhash.blockhash, fundingBlockhash.lastValidBlockHeight);

  const createdAt = new Date(Date.now() - 30_000).toISOString();
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const payment: PaymentRow = {
    id: '8f3d4dd1-4ef0-4a4a-9d98-8d9f2a1c9d91',
    merchant_id: '8f3d4dd1-4ef0-4a4a-9d98-8d9f2a1c9d92',
    amount_atomic: PAYMENT_AMOUNT.toString(),
    customer_total_atomic: PAYMENT_AMOUNT.toString(),
    merchant_net_atomic: SETTLEMENT.toString(),
    merchant_settlement_atomic: SETTLEMENT.toString(),
    fee_atomic: FEE.toString(),
    fee_payer: 'merchant',
    asset: 'SOL',
    token_mint: null,
    token_program: null,
    token_decimals: null,
    recipient: merchant.publicKey.toBase58(),
    fee_recipient: feeRecipient.toBase58(),
    reference: reference.publicKey.toBase58(),
    status: 'created',
    expires_at: expiresAt,
    merchant_business_name: 'Hosted Transaction Devnet E2E',
  };

  const encoded = await buildTransaction(payment, payer.publicKey, connection);
  const transaction = Transaction.from(Buffer.from(encoded, 'base64'));
  transaction.sign(payer);

  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 2,
  });
  const confirmation = await connection.confirmTransaction(signature, 'finalized');
  assert.equal(confirmation.value.err, null);

  const provider = createSolanaRpcProvider({ SOLANA_RPC_URL: DEVNET_RPC_URL });
  const discovered = await provider.findTransactionsByReference(
    reference.publicKey.toBase58(),
    'finalized',
    { createdAt, expiresAt },
  );
  assert.ok(discovered.some((candidate) => candidate.signature === signature), 'server-built payment must be discoverable by its Pay reference');

  const expected: ExpectedPayment = {
    amountAtomic: PAYMENT_AMOUNT.toString(),
    asset: 'SOL',
    tokenMint: null,
    tokenProgram: null,
    tokenDecimals: null,
    merchantDestination: merchant.publicKey.toBase58(),
    feeDestination: feeRecipient.toBase58(),
    merchantSettlementAtomic: SETTLEMENT.toString(),
    gatewayFeeAtomic: FEE.toString(),
    reference: reference.publicKey.toBase58(),
    requiredCommitment: 'finalized',
  };

  const decision = await verifyPayment(provider, expected, signature, new Set(), { createdAt, expiresAt });
  assert.equal(decision.result.valid, true);
  assert.equal(decision.result.reason, 'OK');
  assert.equal(decision.result.status, 'confirmed');
  assert.equal(decision.candidate?.signature, signature);

  const reconciliationPayment: ReconciliationPayment = {
    id: payment.id,
    merchantId: payment.merchant_id,
    createdAt,
    amountAtomic: payment.amount_atomic,
    customerTotalAtomic: payment.customer_total_atomic,
    merchantSettlementAtomic: payment.merchant_settlement_atomic,
    gatewayFeeAtomic: payment.fee_atomic,
    asset: payment.asset,
    tokenMint: payment.token_mint,
    tokenProgram: payment.token_program,
    tokenDecimals: payment.token_decimals,
    recipient: payment.recipient,
    feeRecipient: payment.fee_recipient,
    reference: payment.reference,
    verificationCommitment: 'finalized',
    expiresAt,
    status: 'pending',
  };

  const repository: ReconciliationRepository = {
    async loadKnownSignatures() { return new Set<string>(); },
    async prepareVerification() { return 'ready'; },
    async recordRejectedObservation() {},
    async recordOutcome() { return 'recorded'; },
    async applyVerifiedObservation() { return 'confirmed'; },
    async expirePayment() { return 'expired'; },
  };

  const automatic = await reconcilePayment(provider, repository, reconciliationPayment);
  assert.equal(automatic.outcome, 'confirmed');
  assert.equal(automatic.verification?.candidate?.signature, signature);
});

