/**
 * Gas-sponsorship policy for SolMint Pay.
 *
 * Sponsorship is a cost center, not merchant revenue. The policy therefore
 * fails closed when limits are missing or the available credit is insufficient.
 * Private keys/signers are intentionally outside this module.
 */

export type GasFundingModel = 'merchant_funded' | 'solmint_funded';

export interface GasSponsorPolicyInput {
  enabled: boolean;
  fundingModel: GasFundingModel;
  availableAtomic: bigint;
  perPaymentLimitAtomic: bigint | null;
  dailyLimitAtomic: bigint | null;
  spentTodayAtomic: bigint;
  estimatedNetworkFeeAtomic: bigint;
}

export type GasSponsorDecision =
  | { allowed: true; reason: 'ENABLED'; fundingModel: GasFundingModel }
  | { allowed: false; reason: 'DISABLED' | 'NO_CREDIT' | 'PER_PAYMENT_LIMIT' | 'DAILY_LIMIT' | 'INVALID_COST' };

export function evaluateGasSponsorship(input: GasSponsorPolicyInput): GasSponsorDecision {
  if (!input.enabled) return { allowed: false, reason: 'DISABLED' };
  if (input.estimatedNetworkFeeAtomic <= 0n) return { allowed: false, reason: 'INVALID_COST' };
  if (input.availableAtomic < input.estimatedNetworkFeeAtomic) return { allowed: false, reason: 'NO_CREDIT' };
  if (input.perPaymentLimitAtomic !== null && input.estimatedNetworkFeeAtomic > input.perPaymentLimitAtomic) {
    return { allowed: false, reason: 'PER_PAYMENT_LIMIT' };
  }
  if (input.dailyLimitAtomic !== null && input.spentTodayAtomic + input.estimatedNetworkFeeAtomic > input.dailyLimitAtomic) {
    return { allowed: false, reason: 'DAILY_LIMIT' };
  }

  return { allowed: true, reason: 'ENABLED', fundingModel: input.fundingModel };
}
