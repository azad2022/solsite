import assert from 'node:assert/strict';
import { Connection, Keypair, LAMPORTS_PER_SOL, sendAndConfirmTransaction, SystemProgram, Transaction } from '@solana/web3.js';
import { randomReferenceAddress } from '../../src/pay/services/walletSignature';
import { createSolanaRpcProvider } from '../../src/pay/services/solanaRpcProvider';
import { verifyPaymentTransaction, type ExpectedPayment } from '../../src/pay/services/verificationPolicy';
import type { ObservedPaymentTransaction } from '../../src/pay/services/verificationPolicy';

const RPC_URL = process.env.SOLANA_DEVNET_RPC_URL?.trim() || 'https://api.devnet.solana.com';
const connection = new Connection(RPC_URL, { commitment: 'finalized', confirmTransactionInitialTimeout: 45_000 });

async function waitForFinalized(signature: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const statuses = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
    const status = statuses.value[0];
    if (status?.err) throw new Error(`Devnet transaction failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === 'finalized') return;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error('Devnet transaction did not reach finalized commitment within 60 seconds.');
}

async function requestAirdropWithRetry(address: Keypair['publicKey']): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const signature = await connection.requestAirdrop(address, 1 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(signature, 'confirmed');
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  throw new Error(`Devnet faucet unavailable after retries: ${lastError instanceof Error ? lastError.message : 'unknown error'}`);
}

function withReference(ix: ReturnType<typeof SystemProgram.transfer>, reference: Keypair['publicKey']): ReturnType<typeof SystemProgram.transfer> {
  ix.keys.push({ pubkey: reference, isSigner: false, isWritable: false });
  return ix;
}

async function buildAndSendRealPayment(): Promise<{ expected: ExpectedPayment; observation: ObservedPaymentTransaction; reference: string }> {
  const sender = Keypair.generate();
  const merchant = Keypair.generate();
  const feeRecipient = Keypair.generate();
  const referenceKey = Keypair.generate();
  const reference = referenceKey.publicKey.toBase58();
  const merchantSettlement = 1_000_000n;
  const gatewayFee = 10_000n;
  const total = merchantSettlement + gatewayFee;

  await requestAirdropWithRetry(sender.publicKey);

  const merchantTransfer = withReference(SystemProgram.transfer({
    fromPubkey: sender.publicKey,
    toPubkey: merchant.publicKey,
    lamports: Number(merchantSettlement),
  }), referenceKey.publicKey);

  const feeTransfer = SystemProgram.transfer({
    fromPubkey: sender.publicKey,
    toPubkey: feeRecipient.publicKey,
    lamports: Number(gatewayFee),
  });

  const transaction = new Transaction().add(merchantTransfer, feeTransfer);
  const signature = await sendAndConfirmTransaction(connection, transaction, [sender], { commitment: 'confirmed' });
  await waitForFinalized(signature);

  const provider = createSolanaRpcProvider({ SOLANA_RPC_URL: RPC_URL });
  const candidates = await provider.findTransactionsByReference(
    reference,
    'finalized',
    { createdAt: new Date(Date.now() - 5 * 60_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() },
  );

  assert.equal(candidates.length, 1, `Expected exactly one matching candidate, got ${candidates.length}.`);
  const observation = candidates[0];
  assert.equal(observation.signature, signature);
  assert.equal(observation.referenceMatched, true);
  assert.equal(observation.success, true);
  assert.equal(observation.commitment, 'finalized');
  assert.equal(observation.feePayer, sender.publicKey.toBase58());

  const expected: ExpectedPayment = {
    amountAtomic: total.toString(),
    asset: 'SOL',
    tokenMint: null,
    tokenProgram: null,
    tokenDecimals: null,
    merchantDestination: merchant.publicKey.toBase58(),
    feeDestination: feeRecipient.publicKey.toBase58(),
    merchantSettlementAtomic: merchantSettlement.toString(),
    gatewayFeeAtomic: gatewayFee.toString(),
    reference,
    requiredCommitment: 'finalized',
  };

  const verification = verifyPaymentTransaction(expected, observation);
  assert.deepEqual(verification, { valid: true, status: 'confirmed', reason: 'OK' });
  return { expected, observation, reference };
}

async function main(): Promise<void> {
  const result = await buildAndSendRealPayment();
  console.log(JSON.stringify({
    network: 'devnet',
    signature: result.observation.signature,
    reference: result.reference,
    slot: result.observation.slot,
    blockTime: result.observation.blockTime,
    feePayer: result.observation.feePayer,
    verification: 'confirmed',
  }, null, 2));
}

await main();
