/**
 * Provider-neutral boundary for Solana payment discovery and verification.
 *
 * Implementations may use a dedicated indexer, Solana RPC, or a hybrid. No
 * frontend component is allowed to call RPC/indexer endpoints directly.
 */
import type { SolanaCommitment, ObservedPaymentTransaction } from './verificationPolicy';

export interface SolanaPaymentQuery {
  signature?: string;
  reference?: string;
  destination?: string;
  asset?: 'SOL' | 'USDC' | 'USDT';
}

export interface SolanaPaymentProvider {
  /** Return normalized transaction data when the signature is known. */
  getTransaction(signature: string, commitment: SolanaCommitment): Promise<ObservedPaymentTransaction | null>;

  /**
   * Discover candidate transactions for a payment reference.
   *
   * `createdAt` and `expiresAt` define the authoritative search window. The
   * provider must paginate through that window instead of trusting only the
   * latest N signatures, because a known reference can be spammed after it is
   * exposed in checkout UI.
   */
  findTransactionsByReference(
    reference: string,
    commitment: SolanaCommitment,
    window?: { createdAt: string; expiresAt: string },
  ): Promise<readonly ObservedPaymentTransaction[]>;

  /** Return the current network health/slot snapshot used by workers. */
  getHealth(): Promise<{ ok: boolean; slot: number | null; provider: string }>;
}
