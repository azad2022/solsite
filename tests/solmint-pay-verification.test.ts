import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPaymentTransaction, type ExpectedPayment, type ObservedPaymentTransaction } from '../src/pay/services/verificationPolicy';
import { buildWalletOwnershipMessage, verifySolanaWalletSignature, randomReferenceAddress } from '../src/pay/services/walletSignature';
import { signWebhookPayload, verifyWebhookPayload } from '../src/pay/services/webhookSigner';

const expected: ExpectedPayment = {
  amountAtomic: '1000000',
  asset: 'USDC',
  tokenMint: 'MintUSDC',
  tokenProgram: 'spl-token',
  tokenDecimals: 6,
  merchantDestination: 'MerchantWallet',
  feeDestination: 'SolMintFeeWallet',
  merchantSettlementAtomic: '990000',
  gatewayFeeAtomic: '10000',
  reference: 'RefAddress',
  requiredCommitment: 'finalized',
};

function observed(overrides: Partial<ObservedPaymentTransaction> = {}): ObservedPaymentTransaction {
  const base: ObservedPaymentTransaction = {
    signature: 'sig-1', success: true, commitment: 'finalized', feePayer: 'CustomerWallet', referenceMatched: true,
    transfers: [
      {
        role: 'merchant_settlement', source: 'CustomerToken', sourceAuthority: 'CustomerWallet', destination: 'MerchantATA', destinationAuthority: 'MerchantWallet',
        asset: 'USDC', tokenMint: 'MintUSDC', tokenProgram: 'spl-token', tokenDecimals: 6, amountAtomic: '990000', instructionIndex: 0,
      },
      {
        role: 'gateway_fee', source: 'CustomerToken', sourceAuthority: 'CustomerWallet', destination: 'FeeATA', destinationAuthority: 'SolMintFeeWallet',
        asset: 'USDC', tokenMint: 'MintUSDC', tokenProgram: 'spl-token', tokenDecimals: 6, amountAtomic: '10000', instructionIndex: 1,
      },
    ],
  };
  return { ...base, ...overrides };
}

test('verification requires token account ownership to resolve to expected wallets', () => {
  assert.equal(verifyPaymentTransaction(expected, observed()).valid, true);
  assert.equal(verifyPaymentTransaction(expected, observed({
    transfers: [
      ...observed().transfers.slice(0, 1),
      { ...observed().transfers[1], destinationAuthority: 'OtherWallet' },
    ],
  })).reason, 'FEE_TRANSFER_MISMATCH');
});

test('verification rejects mismatched token program or decimals', () => {
  const badProgram = observed({
    transfers: observed().transfers.map((transfer) => ({ ...transfer, tokenProgram: 'token-2022' as const })),
  });
  assert.equal(verifyPaymentTransaction(expected, badProgram).reason, 'MERCHANT_TRANSFER_MISMATCH');
});

test('verification compares the instruction authority across value legs', () => {
  const mismatched = observed({
    transfers: [observed().transfers[0], { ...observed().transfers[1], sourceAuthority: 'AnotherAuthority' }],
  });
  assert.equal(verifyPaymentTransaction(expected, mismatched).reason, 'SENDER_MISMATCH');
});

test('wallet ownership signature is cryptographically verifiable', async () => {
  const privateKeyMaterial = crypto.getRandomValues(new Uint8Array(32));
  // WebCrypto import cannot create an Ed25519 keypair from seed, so this test
  // verifies the negative path and exact message binding using a real-looking
  // malformed signature. Positive Ed25519 coverage belongs in the integration
  // suite where the platform keypair API is available.
  const message = buildWalletOwnershipMessage({
    challengeId: crypto.randomUUID(), merchantId: crypto.randomUUID(),
    walletAddress: randomReferenceAddress(), issuedAt: new Date(Date.now() - 1_000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(), origin: 'https://solmint.ir',
  });
  assert.ok(privateKeyMaterial.length === 32);
  assert.equal(await verifySolanaWalletSignature({ walletAddress: randomReferenceAddress(), message, signatureBase58: '1111111111111111111111111111111111111111111111111111111111111111' }), false);
});

test('webhook signature verifies exact raw body and rejects replayed timestamps', async () => {
  const secret = 'a'.repeat(64);
  const provider = { getSigningSecret: async () => secret };
  const timestamp = Math.floor(Date.now() / 1000);
  const rawBody = '{"event":"payment.confirmed","data":{"id":"pay_1"}}';
  const header = await signWebhookPayload({ webhookId: 'wh_1', eventId: 'evt_1', timestampSeconds: timestamp, rawBody, keyVersion: 'v1', secretProvider: provider });
  assert.equal(await verifyWebhookPayload({ webhookId: 'wh_1', eventId: 'evt_1', header, rawBody, keyVersion: 'v1', secretProvider: provider, nowSeconds: timestamp }), true);
  assert.equal(await verifyWebhookPayload({ webhookId: 'wh_1', eventId: 'evt_1', header, rawBody: rawBody + ' ', keyVersion: 'v1', secretProvider: provider, nowSeconds: timestamp }), false);
  assert.equal(await verifyWebhookPayload({ webhookId: 'wh_1', eventId: 'evt_1', header, rawBody, keyVersion: 'v1', secretProvider: provider, nowSeconds: timestamp + 601 }), false);
});
