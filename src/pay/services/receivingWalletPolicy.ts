/**
 * Merchant receiving-wallet policy.
 *
 * SolMint Pay does not need custody of merchant settlement funds. A merchant
 * registers a Solana wallet address, proves control by signing a challenge,
 * and receives customer funds directly. The merchant can be offline when a
 * customer pays; only the payer (and, when enabled, the fee sponsor) signs the
 * payment transaction.
 */

const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function validateSolanaAddress(address: string): boolean {
  return BASE58_ADDRESS.test(address.trim());
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
 * The exact signed message must be persisted server-side and verified against
 * the same merchant, wallet and expiration window. Never accept a generic
 * "I own this wallet" message because it is reusable across contexts.
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
