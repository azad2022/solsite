import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import { buildWalletOwnershipMessage, validateChallengeWindow, verifySolanaWalletSignature } from '../src/pay/services/walletSignature';
import { encodeBase58 } from '../src/pay/services/base58';

function rawEd25519PublicKey(key: ReturnType<typeof generateKeyPairSync>['publicKey']): Buffer {
  const der = key.export({ type: 'spki', format: 'der' });
  return Buffer.from(der.subarray(-32));
}

function createWallet() {
  const keypair = generateKeyPairSync('ed25519');
  const publicKey = rawEd25519PublicKey(keypair.publicKey);
  return {
    keypair,
    address: encodeBase58(publicKey),
  };
}

function signMessage(wallet: ReturnType<typeof createWallet>, message: string): string {
  return encodeBase58(sign(null, Buffer.from(message, 'utf8'), wallet.keypair.privateKey));
}

function challengeFixture(now = Date.now()) {
  const issuedAt = new Date(now - 30_000).toISOString();
  const expiresAt = new Date(now + 5 * 60_000).toISOString();
  const merchantId = 'merchant-test-01';
  const challengeId = 'challenge-test-01';
  const wallet = createWallet();
  const message = buildWalletOwnershipMessage({
    origin: 'https://solmint.ir',
    challengeId,
    merchantId,
    walletAddress: wallet.address,
    issuedAt,
    expiresAt,
  });
  return { wallet, message, issuedAt, expiresAt, merchantId, challengeId };
}

test('wallet signature verifier accepts a valid Ed25519 proof', async () => {
  const fixture = challengeFixture();
  const signatureBase58 = signMessage(fixture.wallet, fixture.message);

  assert.equal(
    await verifySolanaWalletSignature({
      walletAddress: fixture.wallet.address,
      message: fixture.message,
      signatureBase58,
    }),
    true,
  );
});

test('wallet signature verifier rejects a tampered message', async () => {
  const fixture = challengeFixture();
  const signatureBase58 = signMessage(fixture.wallet, fixture.message);

  assert.equal(
    await verifySolanaWalletSignature({
      walletAddress: fixture.wallet.address,
      message: `${fixture.message}\nTampered: true`,
      signatureBase58,
    }),
    false,
  );
});

test('wallet signature verifier rejects a signature from a different wallet', async () => {
  const fixture = challengeFixture();
  const otherWallet = createWallet();
  const signatureBase58 = signMessage(otherWallet, fixture.message);

  assert.equal(
    await verifySolanaWalletSignature({
      walletAddress: fixture.wallet.address,
      message: fixture.message,
      signatureBase58,
    }),
    false,
  );
});

test('wallet signature verifier rejects malformed base58 and wrong-length proofs', async () => {
  const fixture = challengeFixture();

  assert.equal(
    await verifySolanaWalletSignature({
      walletAddress: fixture.wallet.address,
      message: fixture.message,
      signatureBase58: 'not-valid-base58-0OIl',
    }),
    false,
  );

  assert.equal(
    await verifySolanaWalletSignature({
      walletAddress: fixture.wallet.address,
      message: fixture.message,
      signatureBase58: encodeBase58(new Uint8Array(63)),
    }),
    false,
  );

  assert.equal(
    await verifySolanaWalletSignature({
      walletAddress: encodeBase58(new Uint8Array(31)),
      message: fixture.message,
      signatureBase58: signMessage(fixture.wallet, fixture.message),
    }),
    false,
  );
});

test('challenge window accepts a valid short-lived window', () => {
  const now = Date.now();
  const issuedAt = new Date(now - 30_000).toISOString();
  const expiresAt = new Date(now + 5 * 60_000).toISOString();
  assert.equal(validateChallengeWindow(issuedAt, expiresAt, now), true);
});

test('challenge window rejects expired, future, and overlong windows', () => {
  const now = Date.now();

  assert.equal(
    validateChallengeWindow(
      new Date(now - 11 * 60_000).toISOString(),
      new Date(now - 60_000).toISOString(),
      now,
    ),
    false,
  );

  assert.equal(
    validateChallengeWindow(
      new Date(now + 1_000).toISOString(),
      new Date(now + 5 * 60_000).toISOString(),
      now,
    ),
    false,
  );

  assert.equal(
    validateChallengeWindow(
      new Date(now - 30_000).toISOString(),
      new Date(now + 11 * 60_000).toISOString(),
      now,
    ),
    false,
  );
});

test('challenge message binds origin, challenge id, merchant id, wallet and timestamps', () => {
  const fixture = challengeFixture();
  const lines = fixture.message.split('\n');

  assert.deepEqual(lines, [
    'SolMint Pay wallet ownership verification',
    'Origin: https://solmint.ir',
    `Challenge: ${fixture.challengeId}`,
    `Merchant: ${fixture.merchantId}`,
    `Wallet: ${fixture.wallet.address}`,
    `Issued: ${fixture.issuedAt}`,
    `Expires: ${fixture.expiresAt}`,
  ]);
});
