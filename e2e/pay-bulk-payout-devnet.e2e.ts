import assert from 'node:assert/strict';
import test from 'node:test';
import { Keypair, Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { buildPayoutTransaction, verifyPayoutObservation, type PayoutBatchSnapshot } from '../src/pay/services/payoutPolicy';
import { createSolanaRpcProvider } from '../src/pay/services/solanaRpcProvider';

const DEVNET_RPC_URL = process.env.SOLANA_RPC_URL?.trim();
const DEVNET_FUNDER_SECRET = process.env.DEVNET_E2E_FUNDER_SECRET_KEY_B64?.trim();
if (!DEVNET_RPC_URL) throw new Error('SOLANA_RPC_URL is required for Bulk Pay Devnet E2E.');
if (!DEVNET_RPC_URL.startsWith('https://')) throw new Error('SOLANA_RPC_URL must use HTTPS for Bulk Pay Devnet E2E.');
if (!DEVNET_FUNDER_SECRET) throw new Error('DEVNET_E2E_FUNDER_SECRET_KEY_B64 is required for Bulk Pay Devnet E2E.');

const EXPECTED_FUNDER = new PublicKey('EZTvPLYyjn6TnXqhiFKw59aqgAPHwxV4qUwhHXctNbXV');
const FUNDING_LAMPORTS = 3_000_000;
const PAYOUT_LAMPORTS = 500_000;
const MIN_FUNDER_BALANCE = FUNDING_LAMPORTS + 1_000_000;

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((char, index) => [char, index]));

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

async function fundSource(connection: Connection, funder: Keypair, source: Keypair): Promise<void> {
  const balance = await connection.getBalance(funder.publicKey, 'finalized');
  assert.ok(balance >= MIN_FUNDER_BALANCE, 'Devnet funder balance is too low for Bulk Pay E2E.');
  const latest = await connection.getLatestBlockhash('finalized');
  const tx = new Transaction({
    feePayer: funder.publicKey,
    recentBlockhash: latest.blockhash,
  }).add(SystemProgram.transfer({
    fromPubkey: funder.publicKey,
    toPubkey: source.publicKey,
    lamports: FUNDING_LAMPORTS,
  }));
  tx.sign(funder);
  const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 2 });
  const confirmation = await connection.confirmTransaction({ signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }, 'finalized');
  assert.equal(confirmation.value.err, null);
}

test('Bulk Pay builds, signs, submits, and verifies a real Devnet SOL payout batch', { timeout: 300_000 }, async () => {
  const connection = new Connection(DEVNET_RPC_URL, 'confirmed');
  const funder = loadFunder(DEVNET_FUNDER_SECRET);
  assert.equal(funder.publicKey.toBase58(), EXPECTED_FUNDER.toBase58());

  const source = Keypair.generate();
  const recipientA = Keypair.generate().publicKey;
  const recipientB = Keypair.generate().publicKey;
  await fundSource(connection, funder, source);

  const batch: PayoutBatchSnapshot = {
    id: 'devnet-bulk-pay-e2e',
    merchantId: 'devnet-merchant',
    asset: 'SOL',
    tokenMint: null,
    tokenProgram: null,
    tokenDecimals: null,
    sourceWalletAddress: source.publicKey.toBase58(),
    totalAmountAtomic: String(PAYOUT_LAMPORTS * 2),
    itemCount: 2,
    items: [
      { recipient: recipientA.toBase58(), amountAtomic: String(PAYOUT_LAMPORTS) },
      { recipient: recipientB.toBase58(), amountAtomic: String(PAYOUT_LAMPORTS) },
    ],
    verificationCommitment: 'finalized',
  };

  const built = await buildPayoutTransaction(batch, source.publicKey, connection);
  assert.ok(built.sizeBytes > 0 && built.sizeBytes <= 1232, 'Bulk Pay must fail closed above the legacy transaction size limit.');

  const tx = Transaction.from(Buffer.from(built.transaction, 'base64'));
  assert.equal(tx.feePayer?.toBase58(), source.publicKey.toBase58());
  assert.equal(tx.instructions.length, 2);
  tx.sign(source);

  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 2,
  });
  const confirmation = await connection.confirmTransaction(signature, 'finalized');
  assert.equal(confirmation.value.err, null);

  const provider = createSolanaRpcProvider({ SOLANA_RPC_URL: DEVNET_RPC_URL });
  const observation = await provider.getTransaction(signature, 'finalized');
  assert.ok(observation, 'Bulk Pay transaction must be observable at finalized commitment.');

  const verification = verifyPayoutObservation(batch, observation);
  assert.deepEqual(verification, { status: 'completed', reason: 'OK' });

  const sourceBalance = await connection.getBalance(source.publicKey, 'finalized');
  assert.ok(sourceBalance < FUNDING_LAMPORTS, 'source wallet should have paid the atomic payout amounts');
});
