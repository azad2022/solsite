import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPayment } from '../src/pay/services/paymentVerifier';
import { verifyPaymentTransaction, type ExpectedPayment, type ObservedPaymentTransaction } from '../src/pay/services/verificationPolicy';
import { buildWalletOwnershipMessage, verifySolanaWalletSignature, randomReferenceAddress } from '../src/pay/services/walletSignature';
import { encodeBase58 } from '../src/pay/services/base58';
import { signWebhookPayload, verifyWebhookPayload } from '../src/pay/services/webhookSigner';

const expected: ExpectedPayment = {
  amountAtomic: '1000000', asset: 'USDC', tokenMint: 'MintUSDC', tokenProgram: 'spl-token', tokenDecimals: 6,
  merchantDestination: 'MerchantWallet', feeDestination: 'SolMintFeeWallet', merchantSettlementAtomic: '990000',
  gatewayFeeAtomic: '10000', reference: 'RefAddress', requiredCommitment: 'finalized',
};

function observed(overrides: Partial<ObservedPaymentTransaction> = {}): ObservedPaymentTransaction {
  const base: ObservedPaymentTransaction = {
    signature: 'sig-1', slot: 10, blockTime: new Date().toISOString(), networkFeeLamports: '5000', success: true, commitment: 'finalized', feePayer: 'CustomerWallet', referenceMatched: true,
    transfers: [
      { role: 'other', source: 'CustomerToken', sourceAuthority: 'CustomerWallet', destination: 'MerchantATA', destinationAuthority: 'MerchantWallet', asset: 'USDC', tokenMint: 'MintUSDC', tokenProgram: 'spl-token', tokenDecimals: 6, amountAtomic: '990000', instructionIndex: 0 },
      { role: 'other', source: 'CustomerToken', sourceAuthority: 'CustomerWallet', destination: 'FeeATA', destinationAuthority: 'SolMintFeeWallet', asset: 'USDC', tokenMint: 'MintUSDC', tokenProgram: 'spl-token', tokenDecimals: 6, amountAtomic: '10000', instructionIndex: 1 },
    ],
  };
  return { ...base, ...overrides };
}

test('verification derives semantic transfer legs from destination and exact amount', () => {
  assert.equal(verifyPaymentTransaction(expected, observed()).valid, true);
});

test('verification rejects wrong fee destination authority', () => {
  const wrongDestination = observed({ transfers: [observed().transfers[0], { ...observed().transfers[1], destinationAuthority: 'OtherWallet' }] });
  assert.equal(verifyPaymentTransaction(expected, wrongDestination).reason, 'FEE_TRANSFER_MISMATCH');
});

test('verification rejects mismatched token program or decimals', () => {
  const badProgram = observed({ transfers: observed().transfers.map((transfer) => ({ ...transfer, tokenProgram: 'token-2022' as const })) });
  assert.equal(verifyPaymentTransaction(expected, badProgram).reason, 'MERCHANT_TRANSFER_MISMATCH');
});

test('verification compares instruction authority across value legs', () => {
  const mismatched = observed({ transfers: [observed().transfers[0], { ...observed().transfers[1], sourceAuthority: 'AnotherAuthority' }] });
  assert.equal(verifyPaymentTransaction(expected, mismatched).reason, 'SENDER_MISMATCH');
});

test('verification rejects duplicate matching merchant settlement legs', () => {
  const duplicateMerchant = observed({ transfers: [observed().transfers[0], { ...observed().transfers[0], instructionIndex: 2 }, observed().transfers[1]] });
  assert.equal(verifyPaymentTransaction(expected, duplicateMerchant).reason, 'AMBIGUOUS_TRANSFER');
});

test('verification rejects duplicate matching gateway fee legs', () => {
  const duplicateFee = observed({ transfers: [observed().transfers[0], observed().transfers[1], { ...observed().transfers[1], instructionIndex: 2 }] });
  assert.equal(verifyPaymentTransaction(expected, duplicateFee).reason, 'AMBIGUOUS_TRANSFER');
});

test('verification rejects multiple independently valid candidate transactions for one payment reference', async () => {
  const first = observed({ signature: 'sig-1' });
  const second = observed({ signature: 'sig-2', slot: 11 });
  const provider = {
    async findTransactionsByReference() { return [first, second]; },
    async getTransaction() { return first; },
    async getHealth() { return { ok: true, slot: 11, provider: 'fake' }; },
  };
  const decision = await verifyPayment(provider, expected);
  assert.equal(decision.candidate, null);
  assert.equal(decision.result.reason, 'AMBIGUOUS_CANDIDATE');
  assert.deepEqual(decision.checkedSignatures, ['sig-1', 'sig-2']);
});

test('verification rejects a previously recognized signature', () => {
  assert.equal(verifyPaymentTransaction(expected, observed(), true).reason, 'DUPLICATE_SIGNATURE');
});

test('wallet ownership proof verifies a real Web Crypto Ed25519 signature and rejects message substitution', async () => {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  if (!('publicKey' in keyPair)) throw new Error('Ed25519 key generation failed.');
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
  const walletAddress = encodeBase58(publicKey);
  const message = buildWalletOwnershipMessage({
    origin: 'https://solmint.ir', challengeId: crypto.randomUUID(), merchantId: crypto.randomUUID(), walletAddress,
    issuedAt: new Date(Date.now() - 1_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, keyPair.privateKey, new TextEncoder().encode(message)));
  const signatureBase58 = encodeBase58(signature);
  assert.equal(await verifySolanaWalletSignature({ walletAddress, message, signatureBase58 }), true);
  assert.equal(await verifySolanaWalletSignature({ walletAddress, message: `${message}\nsubstituted`, signatureBase58 }), false);
});

test('reference addresses are exactly 32-byte Base58 values', () => {
  const reference = randomReferenceAddress();
  assert.equal(typeof reference, 'string');
  assert.equal(reference.length >= 32 && reference.length <= 44, true);
});

test('webhook signature verifies exact raw body and rejects replayed timestamps', async () => {
  const secret = 'a'.repeat(64);
  const provider = { getSigningSecret: async () => secret };
  const timestamp = Math.floor(Date.now() / 1000);
  const rawBody = '{"event":"payment.confirmed","data":{"id":"pay_1"}}';
  const header = await signWebhookPayload({ webhookId: 'wh_1', eventId: 'evt_1', timestampSeconds: timestamp, rawBody, keyVersion: 'v1', secretProvider: provider });
  assert.equal(await verifyWebhookPayload({ webhookId: 'wh_1', eventId: 'evt_1', header, rawBody, keyVersion: 'v1', secretProvider: provider, nowSeconds: timestamp }), true);
  assert.equal(await verifyWebhookPayload({ webhookId: 'wh_1', eventId: 'evt_1', header, rawBody: `${rawBody} `, keyVersion: 'v1', secretProvider: provider, nowSeconds: timestamp }), false);
  assert.equal(await verifyWebhookPayload({ webhookId: 'wh_1', eventId: 'evt_1', header, rawBody, keyVersion: 'v1', secretProvider: provider, nowSeconds: timestamp + 601 }), false);
});
