import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from '@solana/web3.js';
import { randomReferenceAddress } from '../../src/pay/services/walletSignature';
import { createSolanaRpcProvider } from '../../src/pay/services/solanaRpcProvider';
import { verifyPaymentTransaction, type ExpectedPayment, type ObservedPaymentTransaction } from '../../src/pay/services/verificationPolicy';

const RPC_URL = process.env.SOLANA_DEVNET_RPC_URL?.trim() || 'https://api.devnet.solana.com';
const connection = new Connection(RPC_URL, { commitment: 'finalized', confirmTransactionInitialTimeout: 45_000 });

async function waitForFinalized(client: Connection, signature: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const statuses = await client.getSignatureStatuses([signature], { searchTransactionHistory: true });
    const status = statuses.value[0];
    if (status?.err) throw new Error(`Devnet transaction failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === 'finalized') return;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error(`Devnet transaction did not reach finalized commitment within ${timeoutMs} ms.`);
}

async function loadFundedSender(): Promise<Keypair> {
  const keypairPath = process.env.DEVNET_E2E_SENDER_KEYPAIR_PATH?.trim();
  if (!keypairPath) {
    throw new Error('DEVNET_E2E_SENDER_KEYPAIR_PATH is required for the CI Devnet E2E harness.');
  }

  const raw = JSON.parse(await readFile(keypairPath, 'utf8')) as unknown;
  if (!Array.isArray(raw) || raw.length !== 64 || raw.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    throw new Error('CI Devnet E2E keypair file must contain exactly 64 byte values.');
  }
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function withReference(ix: ReturnType<typeof SystemProgram.transfer>, reference: PublicKey): ReturnType<typeof SystemProgram.transfer> {
  ix.keys.push({ pubkey: reference, isSigner: false, isWritable: false });
  return ix;
}

async function buildAndSendRealPayment(): Promise<{ expected: ExpectedPayment; observation: ObservedPaymentTransaction; reference: string }> {
  const sender = await loadFundedSender();
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
  await waitForFinalized(connection, signature);

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
