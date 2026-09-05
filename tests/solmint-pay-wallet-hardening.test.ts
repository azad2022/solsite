import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';

import { encodeBase58 } from '../src/pay/services/base58';
import { buildWalletOwnershipMessage, verifySolanaWalletSignature } from '../src/pay/services/walletSignature';

function rawEd25519PublicKey(key: ReturnType<typeof generateKeyPairSync>['publicKey']): Uint8Array {
  const der = key.export({ format: 'der', type: 'spki' });
  return new Uint8Array(der.subarray(-32));
}

function makeMessage(wallet: string): string {
  return buildWalletOwnershipMessage({
    origin: 'https://solmint.ir',
    challengeId: '00000000-0000-4000-8000-000000000001',
    merchantId: 'merchant-1',
    walletAddress: wallet,
    issuedAt: new Date(Date.now() - 1_000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
}

test('wallet proof verifies only with the exact Ed25519 public key and message', async () => {
  const signer = generateKeyPairSync('ed25519');
  const otherSigner = generateKeyPairSync('ed25519');
  const wallet = encodeBase58(rawEd25519PublicKey(signer.publicKey));
  const otherWallet = encodeBase58(rawEd25519PublicKey(otherSigner.publicKey));
  const message = makeMessage(wallet);
  const signatureBase58 = encodeBase58(new Uint8Array(sign(null, Buffer.from(message), signer.privateKey)));

  assert.equal(await verifySolanaWalletSignature({ walletAddress: wallet, message, signatureBase58 }), true);
  assert.equal(await verifySolanaWalletSignature({ walletAddress: otherWallet, message, signatureBase58 }), false);
  assert.equal(await verifySolanaWalletSignature({ walletAddress: wallet, message: `${message}\nTampered: true`, signatureBase58 }), false);
});

test('wallet proof rejects malformed encoding and wrong signature length', async () => {
  const signer = generateKeyPairSync('ed25519');
  const wallet = encodeBase58(rawEd25519PublicKey(signer.publicKey));
  const message = makeMessage(wallet);
  const validSignature = new Uint8Array(sign(null, Buffer.from(message), signer.privateKey));

  assert.equal(await verifySolanaWalletSignature({ walletAddress: wallet, message, signatureBase58: '0'.repeat(88) }), false);
  assert.equal(await verifySolanaWalletSignature({ walletAddress: wallet, message, signatureBase58: encodeBase58(validSignature.subarray(0, 63)) }), false);
  assert.equal(await verifySolanaWalletSignature({ walletAddress: '0'.repeat(44), message, signatureBase58: encodeBase58(validSignature) }), false);
});
