import assert from 'node:assert/strict';
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from '@solana/web3.js';
import { randomReferenceAddress } from '../../src/pay/services/walletSignature';
import { createSolanaRpcProvider } from '../../src/pay/services/solanaRpcProvider';
import { verifyPaymentTransaction, type ExpectedPayment, type ObservedPaymentTransaction } from '../../src/pay/services/verificationPolicy';

const RPC_URL = process.env.SOLANA_DEVNET_RPC_URL?.trim() || 'https://api.devnet.solana.com';
const connection = new Connection(RPC_URL, { commitment: 'finalized', confirmTransactionInitialTimeout: 45_000 });

function loadFundedSender(): Keypair {
  const encoded = process.env.DEVNET_E2E_SENDER_SECRET_KEY?.trim();
  if (!encoded) throw new Error('DEVNET_E2E_SENDER_SECRET_KEY is required for repeatable Devnet E2E. Store only a funded Devnet test key in GitHub Actions Secrets.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    throw new Error('DEVNET_E2E_SENDER_SECRET_KEY must be a JSON array of 64 secret-key bytes.');
  }
  if (!Array.isArray(parsed) || parsed.length !== 64 || parsed.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    throw new Error('DEVNET_E2E_SENDER_SECRET_KEY must contain exactly 64 byte values.');
  }
  return Keypair.fromSecretKey(Uint8Array.from(parsed as number[]));
}

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

function withReference(ix: ReturnType<typeof SystemProgram.transfer>, reference: PublicKey): ReturnType<typeof SystemProgram.transfer> {
  ix.keys.push({ pubkey: reference, isSigner: false, isWritable: false });
  return ix;
}

async function buildAndSendRealPayment(): Promise<{ expected: ExpectedPayment; observation: ObservedPaymentTransaction; reference: string }> {
  const sender = loadFundedSender();
  const merchant = Keypair.generate();
  const feeRecipient = Keypair.generate();
  const reference = new PublicKey(randomReferenceAddress());
  const merchantSettlement = 1_000_000n;
  const gatewayFee = 10_000n;
  const total = merchantSettlement + gatewayFee;

  const senderBalance = await connection.getBalance(sender.publicKey, 'finalized');
  assert.ok(senderBalance > Number(total) + 10_000, 'Devnet E2E sender is not funded sufficiently.');

  const merchantTransfer = withReference(SystemProgram.transfer({
    fromPubkey: sender.publicKey,
    toPubkey: merchant.publicKey,
    lamports: Number(merchantSettlement),
  }), reference);

  const feeTransfer = SystemProgram.transfer({
    fromPubkey: sender.publicKey,
    toPubkey: feeRecipient.publicKey,
    lamports: Number(gatewayFee),
  });

  const { blockhash } = await connection.getLatestBlockhash('finalized');
  const transaction = new Transaction({ recentBlockhash: blockhash, feePayer: sender.publicKey })
    .add(merchantTransfer, feeTransfer);
  const signature = await sendAndConfirmTransaction(connection, transaction, [sender], { commitment: 'confirmed' });
  await waitForFinalized(signature);

  const provider = createSolanaRpcProvider({ SOLANA_RPC_URL: RPC_URL });
  const candidates = await provider.findTransactionsByReference(
    reference.toBase58(),
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
  assert.equal(observation.transfers.filter((transfer) => transfer.asset === 'SOL').length, 2);

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
    reference: reference.toBase58(),
    requiredCommitment: 'finalized',
  };

  const verification = verifyPaymentTransaction(expected, observation);
  assert.deepEqual(verification, { valid: true, status: 'confirmed', reason: 'OK' });
  return { expected, observation, reference: reference.toBase58() };
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
