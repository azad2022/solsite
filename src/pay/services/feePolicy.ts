/**
 * Pure financial helpers for SolMint Pay.
 *
 * No RPC, storage, locale, or UI dependency belongs in this module. All
 * monetary values remain integer atomic units represented as decimal strings.
 */

export type FeePayer = 'merchant' | 'customer';

export interface CalculatedFee {
  gatewayFeeAtomic: string;
  customerTotalAtomic: string;
  merchantNetAtomic: string;
}

/**
 * Calculates the 1% gateway fee using ceiling division.
 * Ceiling avoids silently charging zero atomic units for a positive payment.
 * A production minimum-fee policy may still reject transactions where this
 * rounding would make the effective fee unreasonably high.
 */
export function calculateGatewayFee(amountAtomic: string, feeBps: number, payer: FeePayer): CalculatedFee {
  const amount = BigInt(amountAtomic);
  if (amount <= 0n) throw new Error('Amount must be greater than zero.');
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10000) {
    throw new Error('Fee rate must be an integer between 0 and 10000 bps.');
  }

  const fee = (amount * BigInt(feeBps) + 9999n) / 10000n;
  const merchantNet = payer === 'merchant' ? amount - fee : amount;
  const customerTotal = payer === 'customer' ? amount + fee : amount;

  if (merchantNet < 0n) throw new Error('Gateway fee exceeds the merchant amount.');
  return {
    gatewayFeeAtomic: fee.toString(),
    customerTotalAtomic: customerTotal.toString(),
    merchantNetAtomic: merchantNet.toString(),
  };
}
