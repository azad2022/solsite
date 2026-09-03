import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateGasSponsorship } from '../src/pay/services/gasSponsorPolicy';
import { calculateGatewayFee } from '../src/pay/services/feePolicy';
import { recognizeGatewayRevenue } from '../src/pay/services/revenueRecognition';
import { verifyPaymentTransaction } from '../src/pay/services/verificationPolicy';

test('gateway fee ceiling implements the V1 1% gateway fee', () => {
  assert.deepEqual(calculateGatewayFee('10000', 100, 'merchant'), {
    gatewayFeeAtomic: '100', customerTotalAtomic: '10000', merchantNetAtomic: '9900',
  });
  assert.deepEqual(calculateGatewayFee('10001', 100, 'merchant'), {
    gatewayFeeAtomic: '101', customerTotalAtomic: '10001', merchantNetAtomic: '9900',
  });
});

test('customer-paid fee increases customer total without changing merchant principal', () => {
  assert.deepEqual(calculateGatewayFee('10000', 100, 'customer'), {
    gatewayFeeAtomic: '100', customerTotalAtomic: '10100', merchantNetAtomic: '10000',
  });
});

test('gas sponsorship fails closed when credit is insufficient', () => {
  const decision = evaluateGasSponsorship({ enabled: true, fundingModel: 'solmint_funded', availableAtomic: 49n, perPaymentLimitAtomic: 100n, dailyLimitAtomic: 1000n, spentTodayAtomic: 0n, estimatedNetworkFeeAtomic: 50n });
  assert.deepEqual(decision, { allowed: false, reason: 'NO_CREDIT' });
});

test('gas sponsorship obeys per-payment and daily limits', () => {
  const paymentLimit = evaluateGasSponsorship({ enabled: true, fundingModel: 'merchant_funded', availableAtomic: 1000n, perPaymentLimitAtomic: 40n, dailyLimitAtomic: 1000n, spentTodayAtomic: 0n, estimatedNetworkFeeAtomic: 50n });
  assert.deepEqual(paymentLimit, { allowed: false, reason: 'PER_PAYMENT_LIMIT' });
  const dailyLimit = evaluateGasSponsorship({ enabled: true, fundingModel: 'merchant_funded', availableAtomic: 1000n, perPaymentLimitAtomic: 100n, dailyLimitAtomic: 1000n, spentTodayAtomic: 980n, estimatedNetworkFeeAtomic: 50n });
  assert.deepEqual(dailyLimit, { allowed: false, reason: 'DAILY_LIMIT' });
});

test('revenue recognition keeps referral liability inside gross gateway revenue', () => {
  assert.deepEqual(recognizeGatewayRevenue('1000', 2000), { grossGatewayFeeAtomic: '1000', referralCommissionAtomic: '200', netGatewayRevenueAtomic: '800' });
});

test('verification rejects split-source transfer legs', () => {
  const result = verifyPaymentTransaction(
    { amountAtomic: '101000000', asset: 'USDC', tokenMint: 'USDC_MINT', tokenProgram: 'spl-token', tokenDecimals: 6, merchantDestination: 'MERCHANT_ATA', feeDestination: 'SOLMINT_ATA', merchantSettlementAtomic: '100000000', gatewayFeeAtomic: '1000000', reference: 'REF', requiredCommitment: 'finalized' },
    {
      signature: 'SIG', success: true, commitment: 'finalized', feePayer: 'CUSTOMER', referenceMatched: true,
      transfers: [
        { role: 'other', source: 'CUSTOMER_A', sourceAuthority: 'AUTH_A', destination: 'MERCHANT_ATA', destinationAuthority: 'MERCHANT', asset: 'USDC', tokenMint: 'USDC_MINT', tokenProgram: 'spl-token', tokenDecimals: 6, amountAtomic: '100000000', instructionIndex: 0 },
        { role: 'other', source: 'CUSTOMER_B', sourceAuthority: 'AUTH_B', destination: 'SOLMINT_ATA', destinationAuthority: 'SOLMINT', asset: 'USDC', tokenMint: 'USDC_MINT', tokenProgram: 'spl-token', tokenDecimals: 6, amountAtomic: '1000000', instructionIndex: 1 },
      ],
    },
  );
  assert.deepEqual(result, { valid: false, status: 'wrong_recipient', reason: 'MERCHANT_TRANSFER_MISMATCH' });
});

test('verification rejects unsponsored transaction with a different fee payer', () => {
  const result = verifyPaymentTransaction(
    { amountAtomic: '101000000', asset: 'USDC', tokenMint: 'USDC_MINT', tokenProgram: 'spl-token', tokenDecimals: 6, merchantDestination: 'MERCHANT_ATA', feeDestination: 'SOLMINT_ATA', merchantSettlementAtomic: '100000000', gatewayFeeAtomic: '1000000', reference: 'REF', requiredCommitment: 'finalized', expectedSponsorAddress: null },
    {
      signature: 'SIG2', success: true, commitment: 'finalized', feePayer: 'OTHER_PAYER', referenceMatched: true,
      transfers: [
        { role: 'other', source: 'CUSTOMER', sourceAuthority: 'CUSTOMER', destination: 'MERCHANT_ATA', destinationAuthority: 'MERCHANT', asset: 'USDC', tokenMint: 'USDC_MINT', tokenProgram: 'spl-token', tokenDecimals: 6, amountAtomic: '100000000', instructionIndex: 0 },
        { role: 'other', source: 'CUSTOMER', sourceAuthority: 'CUSTOMER', destination: 'SOLMINT_ATA', destinationAuthority: 'SOLMINT', asset: 'USDC', tokenMint: 'USDC_MINT', tokenProgram: 'spl-token', tokenDecimals: 6, amountAtomic: '1000000', instructionIndex: 1 },
      ],
    },
  );
  assert.deepEqual(result, { valid: false, status: 'wrong_recipient', reason: 'MERCHANT_TRANSFER_MISMATCH' });
});
