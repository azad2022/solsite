import { decodeBase58 } from './base58';

/**
 * Merchant receiving-wallet policy.
 *
 * SolMint Pay never needs the merchant private key. The merchant proves wallet
 * control with a short-lived signed challenge and then receives settlement
 * directly at the registered address.
 */
export function validateSolanaAddress(address: string): boolean {
  try {
    return decodeBase58(address.trim()).length === 32;
  } catch {
    return false;
  }
}

export interface WalletOwnershipChallenge {
  challengeId: string;
  merchantId: string;
  walletAddress: string;
  message: string;
  issuedAt: string;
  expiresAt: string;
}

/**
 * Legacy policy helper retained for domain documentation. Runtime signing must
 * use walletSignature.buildWalletOwnershipMessage so one canonical message is
 * used everywhere.
 */
export function buildWalletOwnershipMessage(input: {
  challengeId: string;
  merchantId: string;
  walletAddress: string;
  issuedAt: string;
  expiresAt: string;
}): string {
  return [
    'SolMint Pay wallet ownership verification',
    `Challenge: ${input.challengeId}`,
    `Merchant: ${input.merchantId}`,
    `Wallet: ${input.walletAddress}`,
    `Issued: ${input.issuedAt}`,
    `Expires: ${input.expiresAt}`,
  ].join('\n');
}
