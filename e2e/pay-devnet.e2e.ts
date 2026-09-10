import assert from 'node:assert/strict';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import test from 'node:test';
import { createSolanaRpcProvider } from '../src/pay/services/solanaRpcProvider';
import { verifyPayment } from '../src/pay/services/paymentVerifier';
import type { ExpectedPayment } from '../src/pay/services/verificationPolicy';

const DEVNET_RPC_URL = process.env.SOLANA_RPC_URL?.trim() || 'https://api.devnet.solana.com';
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const PAYMENT_AMOUNT_LAMPORTS = 1_000_000_000n;
const MERCHANT_SETTLEMENT_LAMPORTS = 990_000_000n;
const GATEWAY_FEE_LAMPORTS = 10_000_000n;
const AIRDROP_LAMPORTS = 2 * LAMPORTS_PER_SOL;
const TIMEOUT_MS = 90_000;

async function waitForFinalized(connection: Connection, signature: string): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const status = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
    if (status.value[0]?.confirmationStatus === 'finalized') return;
    if (status.value[0]?.err) throw new Error(`Devnet transaction failed: ${JSON.stringify(status.value[0].err)}`);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error(`Timed out waiting for finalized transaction ${signature}`);
}

test('SolMint Pay verification discovers and verifies a real Devnet SOL payment', { timeout: TIMEOUT_MS + 30_000 }, async () => {
  const connection = new Connection(DEVNET_RPC_URL, 'confirmed');
  const payer = Keypair.generate();
  const merchant = Keypair.generate().publicKey;
  const fee = Keypair.generate().publicKey;
  const reference = Keypair.generate().publicKey;

  const airdropSignature = await connection.requestAirdrop(payer.publicKey, AIRDROP_LAMPORTS);
  await waitForFinalized(connection, airdropSignature);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
  const paymentTransaction = new Transaction({ feePayer: payer.publicKey, recentBlockhash: blockhash });
  paymentTransaction.add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: merchant,
      lamports: MERCHANT_SETTLEMENT_LAMPORTS,
    }),
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: fee,
      lamports: GATEWAY_FEE_LAMPORTS,
    }),
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [{ pubkey: reference, isSigner: false, isWritable: false }],
      data: Buffer.from(`solmint-pay-devnet:${reference.toBase58()}`),
    }),
  );

  const signature = await connection.sendTransaction(paymentTransaction, [payer], { skipPreflight: false, preflightCommitment: 'confirmed' });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'finalized');
  await waitForFinalized(connection, signature);

  const provider = createSolanaRpcProvider({ SOLANA_RPC_URL: DEVNET_RPC_URL });
  const directObservation = await provider.getTransaction(signature, 'finalized');
  assert.ok(directObservation, 'the real Devnet transaction must be readable by the Pay provider');
  assert.equal(directObservation?.success, true);

  const discovered = await provider.findTransactionsByReference(reference.toBase58(), 'finalized', {
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  });
  assert.ok(discovered.some((observation) => observation.signature === signature), 'the real transaction must be discoverable through its Pay reference');

  const expected: ExpectedPayment = {
    amountAtomic: PAYMENT_AMOUNT_LAMPORTS.toString(),
    asset: 'SOL',
    tokenMint: null,
    tokenProgram: null,
    tokenDecimals: null,
    merchantDestination: merchant.toBase58(),
    feeDestination: fee.toBase58(),
    merchantSettlementAtomic: MERCHANT_SETTLEMENT_LAMPORTS.toString(),
    gatewayFeeAtomic: GATEWAY_FEE_LAMPORTS.toString(),
    reference: reference.toBase58(),
    requiredCommitment: 'finalized',
  };

  const decision = await verifyPayment(
    provider,
    expected,
    signature,
    new Set(),
    {
      createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    },
  );

  assert.equal(decision.result.valid, true);
  assert.equal(decision.result.reason, 'OK');
  assert.equal(decision.result.status, 'confirmed');
  assert.equal(decision.candidate?.signature, signature);
});
