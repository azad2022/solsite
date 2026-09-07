/**
 * Pure settlement planner for SolMint Pay.
 *
 * A payment is represented as one customer-signed value transfer plan. The
 * plan can contain two value-transfer legs: merchant settlement and gateway
 * revenue. A separate fee sponsor may pay the Solana network fee.
 *
 * The planner does not build or sign transactions and has no RPC/storage/UI
 * dependency. Its job is to make the financial intent deterministic before a
 * blockchain transaction is created.
 */
import { calculateGatewayFee, type FeePayer } from './feePolicy';
import type { PaymentAsset } from '../types/domain';

export interface SettlementLeg {
  role: 'merchant_settlement' | 'gateway_fee';
  destination: string;
  asset: PaymentAsset;
  tokenMint: string | null;
  amountAtomic: string;
}

export interface SettlementPlan {
  principalAtomic: string;
  gatewayFeeAtomic: string;
  customerTotalAtomic: string;
  merchantNetAtomic: string;
  feePayer: FeePayer;
  merchantDestination: string;
  feeDestination: string;
  legs: readonly SettlementLeg[];
}

export function buildSettlementPlan(input: {
  amountAtomic: string;
  feeBps: number;
  feePayer: FeePayer;
  asset: PaymentAsset;
  tokenMint: string | null;
  merchantDestination: string;
  feeDestination: string;
}): SettlementPlan {
  const result = calculateGatewayFee(input.amountAtomic, input.feeBps, input.feePayer);

  // For a merchant-paid gateway fee, a positive principal must leave something
  // to settle to the merchant. Tiny atomic-unit payments can otherwise round a
  // 1% fee up to the full amount and leave a zero merchant settlement.
  if (input.feePayer === 'merchant' && result.merchantNetAtomic === '0') {
    throw new Error('PAYMENT_AMOUNT_TOO_SMALL_FOR_MERCHANT_FEE');
  }

  return {
    principalAtomic: input.amountAtomic,
    gatewayFeeAtomic: result.gatewayFeeAtomic,
    customerTotalAtomic: result.customerTotalAtomic,
    merchantNetAtomic: result.merchantNetAtomic,
    feePayer: input.feePayer,
    merchantDestination: input.merchantDestination,
    feeDestination: input.feeDestination,
    legs: [
      {
        role: 'merchant_settlement',
        destination: input.merchantDestination,
        asset: input.asset,
        tokenMint: input.tokenMint,
        amountAtomic: result.merchantNetAtomic,
      },
      {
        role: 'gateway_fee',
        destination: input.feeDestination,
        asset: input.asset,
        tokenMint: input.tokenMint,
        amountAtomic: result.gatewayFeeAtomic,
      },
    ],
  };
}
