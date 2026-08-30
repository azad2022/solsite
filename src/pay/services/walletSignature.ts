import * as ed25519 from '@noble/ed25519';
import { decodeBase58, encodeBase58 } from './base58';

const MAX_CHALLENGE_AGE_MS = 10 * 60 * 1000;
const PUBLIC_KEY_BYTES = 32;
const SIGNATURE_BYTES = 64;

export function buildWalletOwnershipMessage(input: { origin: string; challengeId: string; merchantId: string; walletAddress: string; issuedAt: string; expiresAt: string }): string {
  return [
    'SolMint Pay wallet ownership verification',
    `Origin: ${input.origin}`,
    `Challenge: ${input.challengeId}`,
    `Merchant: ${input.merchantId}`,
    `Wallet: ${input.walletAddress}`,
    `Issued: ${input.issuedAt}`,
    `Expires: ${input.expiresAt}`,
  ].join('\n');
}

export function validateChallengeWindow(issuedAt: string, expiresAt: string, now = Date.now()): boolean {
  const issued = Date.parse(issuedAt);
  const expires = Date.parse(expiresAt);
  return Number.isFinite(issued) && Number.isFinite(expires) && expires > issued && expires - issued <= MAX_CHALLENGE_AGE_MS && issued <= now && now < expires;
}

/**
 * Verify a wallet proof using Ed25519. The strict RFC8032/FIPS-compatible mode
 * is used for an explicit ownership proof, avoiding non-canonical ZIP215 forms
 * that are not necessary for this application-level authentication artifact.
 */
export async function verifySolanaWalletSignature(input: { walletAddress: string; message: string; signatureBase58: string }): Promise<boolean> {
  let publicKey: Uint8Array;
  let signature: Uint8Array;
  try {
    publicKey = decodeBase58(input.walletAddress);
    signature = decodeBase58(input.signatureBase58);
  } catch {
    return false;
  }
  if (publicKey.length !== PUBLIC_KEY_BYTES || signature.length !== SIGNATURE_BYTES) return false;

  try {
    // Reject malformed/non-canonical Ed25519 public keys before verification.
    ed25519.Point.fromBytes(publicKey, false);
    return await ed25519.verifyAsync(signature, new TextEncoder().encode(input.message), publicKey, { zip215: false });
  } catch {
    return false;
  }
}

export function createReferenceAddress(randomBytes: Uint8Array): string {
  if (randomBytes.length !== 32) throw new Error('Reference seed must be exactly 32 bytes.');
  return encodeBase58(randomBytes);
}

export function randomReferenceAddress(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return createReferenceAddress(bytes);
}
