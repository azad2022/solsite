import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';

import { encodeBase58 } from '../src/pay/services/base58';
import { buildWalletOwnershipMessage, randomReferenceAddress, validateChallengeWindow, verifySolanaWalletSignature } from '../src/pay/services/walletSignature';

function rawEd25519PublicKey(key: ReturnType<typeof generateKeyPairSync>['publicKey']): Uint8Array {
  const der = key.export({ format: 'der', type: 'spki' });
  return new Uint8Array(der.subarray(-32));
}

test('wallet ownership signature verifies exact merchant-bound challenge', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const wallet = encodeBase58(rawEd25519PublicKey(publicKey));
  const message = buildWalletOwnershipMessage({
    origin: 'https://solmint.ir',
    challengeId: 'challenge-1',
    merchantId: 'merchant-1',
    walletAddress: wallet,
    issuedAt: new Date(Date.now() - 1_000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const signature = sign(null, Buffer.from(message), privateKey);

  assert.equal(await verifySolanaWalletSignature({ walletAddress: wallet, message, signatureBase58: encodeBase58(new Uint8Array(signature)) }), true);
  assert.equal(await verifySolanaWalletSignature({ walletAddress: wallet, message: `${message}\nTampered: true`, signatureBase58: encodeBase58(new Uint8Array(signature)) }), false);
});

test('wallet challenge window is bounded and expired challenges are rejected', () => {
  const now = Date.now();
  assert.equal(validateChallengeWindow(new Date(now - 60_000).toISOString(), new Date(now + 60_000).toISOString(), now), true);
  assert.equal(validateChallengeWindow(new Date(now - 11 * 60_000).toISOString(), new Date(now + 60_000).toISOString(), now), false);
  assert.equal(validateChallengeWindow(new Date(now - 120_000).toISOString(), new Date(now - 60_000).toISOString(), now), false);
});

test('Solana payment references are 32-byte Base58 addresses', () => {
  const reference = randomReferenceAddress();
  const alphabet = /^[1-9A-HJ-NP-Za-km-z]+$/;
  assert.equal(alphabet.test(reference), true);
  assert.equal(reference.length >= 32 && reference.length <= 44, true);
});
