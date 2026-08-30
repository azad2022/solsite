/**
 * Provider boundary for sponsored Solana transactions.
 *
 * The Pay application only knows how to request sponsorship. Key management,
 * HSM/KMS/Kora integration, transaction signing and submission belong to an
 * infrastructure implementation. No private key material is allowed in the
 * frontend or Supabase tables.
 */
import type { SolanaCommitment } from './verificationPolicy';

export interface SponsorableTransaction {
  serializedUnsignedBase64: string;
  expectedSponsorAddress: string;
  expectedNetwork: 'solana';
  paymentId: string;
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
