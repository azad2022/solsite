/**
 * Deterministic gateway-revenue recognition.
 *
 * Revenue is recognized only after blockchain verification. Referral commission
 * is a liability against that recognized gateway fee, not against gross payment
 * principal. All arithmetic is integer-only to avoid rounding drift.
 */

export interface RevenueRecognition {
  grossGatewayFeeAtomic: string;
  referralCommissionAtomic: string;
  netGatewayRevenueAtomic: string;
}

export function recognizeGatewayRevenue(
  grossGatewayFeeAtomic: string,
  commissionRateBps: number,
): RevenueRecognition {
  const gross = BigInt(grossGatewayFeeAtomic);
  if (gross <= 0n) throw new Error('Gateway revenue must be greater than zero.');
  if (!Number.isInteger(commissionRateBps) || commissionRateBps < 0 || commissionRateBps > 10000) {
    throw new Error('Commission rate must be between 0 and 10000 bps.');
  }

  // Commission uses floor division. A one-atomic-unit commission should never
  // be rounded above the gross fee and the gateway retains the remainder.
  const commission = (gross * BigInt(commissionRateBps)) / 10000n;
  return {
    grossGatewayFeeAtomic: gross.toString(),
    referralCommissionAtomic: commission.toString(),
    netGatewayRevenueAtomic: (gross - commission).toString(),
  };
}
