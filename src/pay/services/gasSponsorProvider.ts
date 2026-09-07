/**
 * Provider boundary for sponsored Solana transactions.
 *
 * The Pay application only knows how to request sponsorship. Key management,
 * HSM/KMS/Kora integration, transaction signing and submission belong to an
 * infrastructure implementation. No private key material is allowed in the
 * frontend or Supabase tables.
 *
 * SECURITY REQUIREMENT: a concrete provider must parse and validate the
 * unsigned transaction before signing. It must prove that the transaction is
 * bound to the supplied payment intent, approved sponsor address, expected
 * network, permitted instructions, and current sponsorship limits. A provider
 * must never become an arbitrary transaction-signing oracle.
 */
import type { SolanaCommitment } from './verificationPolicy';

export interface SponsorableTransaction {
  /** Canonical unsigned transaction bytes encoded as base64. */
  serializedUnsignedBase64: string;
  /** Payment intent this transaction is allowed to satisfy. */
  paymentId: string;
  /** Sponsor pubkey that must occupy the transaction fee-payer position. */
  expectedSponsorAddress: string;
  expectedNetwork: 'solana';
}

export interface SponsoredSubmission {
  signature: string;
  commitment: SolanaCommitment;
}

export interface GasSponsorProvider {
  getSponsorAddress(): string;
  estimateFee(serializedUnsignedBase64: string): Promise<bigint>;
  sponsorAndSubmit(input: SponsorableTransaction): Promise<SponsoredSubmission>;
  getBalanceAtomic(): Promise<bigint>;
}
