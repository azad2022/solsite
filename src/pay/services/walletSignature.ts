import { decodeBase58, encodeBase58 } from './base58';

const MAX_CHALLENGE_AGE_MS = 10 * 60 * 1000;
const PUBLIC_KEY_BYTES = 32;
const SIGNATURE_BYTES = 64;

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

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
 * Verify an application-level Solana wallet ownership proof with Ed25519.
 * Web Crypto is used because the deployed runtimes provide the primitive;
 * this keeps the signing boundary small and avoids an unnecessary dependency.
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
    const key = await crypto.subtle.importKey('raw', toArrayBuffer(publicKey), { name: 'Ed25519' }, false, ['verify']);
    const messageBytes = new TextEncoder().encode(input.message);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, toArrayBuffer(signature), toArrayBuffer(messageBytes));
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
