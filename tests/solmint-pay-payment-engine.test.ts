import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSettlementPlan } from '../src/pay/services/settlementPlan';
import { verifyPaymentTransaction } from '../src/pay/services/verificationPolicy';

test('merchant-paid fee splits the customer amount into merchant and gateway legs', () => {
  const plan = buildSettlementPlan({ amountAtomic: '100000000', feeBps: 100, feePayer: 'merchant', asset: 'USDC', tokenMint: 'USDC_MINT', merchantDestination: 'MERCHANT', feeDestination: 'SOLMINT' });
  assert.equal(plan.customerTotalAtomic, '100000000');
  assert.equal(plan.merchantNetAtomic, '99000000');
  assert.deepEqual(plan.legs.map((leg) => [leg.role, leg.amountAtomic]), [['merchant_settlement', '99000000'], ['gateway_fee', '1000000']]);
});

test('customer-paid fee preserves merchant principal and increases customer total', () => {
  const plan = buildSettlementPlan({ amountAtomic: '100000000', feeBps: 100, feePayer: 'customer', asset: 'USDC', tokenMint: 'USDC_MINT', merchantDestination: 'MERCHANT', feeDestination: 'SOLMINT' });
  assert.equal(plan.customerTotalAtomic, '101000000');
  assert.equal(plan.merchantNetAtomic, '100000000');
});

test('merchant-paid fee rejects a one-atomic-unit payment because rounding would consume it', () => {
  assert.throws(() => buildSettlementPlan({ amountAtomic: '1', feeBps: 100, feePayer: 'merchant', asset: 'USDC', tokenMint: 'USDC_MINT', merchantDestination: 'MERCHANT', feeDestination: 'SOLMINT' }), /PAYMENT_AMOUNT_TOO_SMALL_FOR_MERCHANT_FEE/);
});

test('verification requires finalized commitment, reference, exact settlement, token metadata, and exact gateway fee', () => {
  const expected = {
    amountAtomic: '100000000', asset: 'USDC' as const, tokenMint: 'USDC_MINT', tokenProgram: 'spl-token' as const, tokenDecimals: 6,
    merchantDestination: 'MERCHANT', feeDestination: 'SOLMINT', merchantSettlementAtomic: '99000000', gatewayFeeAtomic: '1000000',
    reference: 'REFERENCE', requiredCommitment: 'finalized' as const,
  };
  const observed = {
    signature: 'SIGNATURE', success: true, commitment: 'finalized' as const, feePayer: 'CUSTOMER', referenceMatched: true,
    transfers: [
      { role: 'other' as const, source: 'CUSTOMER', sourceAuthority: 'CUSTOMER_AUTH', destination: 'MERCHANT_ATA', destinationAuthority: 'MERCHANT', asset: 'USDC' as const, tokenMint: 'USDC_MINT', tokenProgram: 'spl-token' as const, tokenDecimals: 6, amountAtomic: '99000000', instructionIndex: 0 },
      { role: 'other' as const, source: 'CUSTOMER', sourceAuthority: 'CUSTOMER_AUTH', destination: 'SOLMINT_ATA', destinationAuthority: 'SOLMINT', asset: 'USDC' as const, tokenMint: 'USDC_MINT', tokenProgram: 'spl-token' as const, tokenDecimals: 6, amountAtomic: '1000000', instructionIndex: 1 },
    ],
  };
  assert.deepEqual(verifyPaymentTransaction(expected, observed), { valid: true, status: 'confirmed', reason: 'OK' });
});

test('verification rejects an unfinalized observation without changing accounting state', () => {
  const expected = { amountAtomic: '100000000', asset: 'SOL' as const, tokenMint: null, tokenProgram: null, tokenDecimals: null, merchantDestination: 'MERCHANT', feeDestination: 'SOLMINT', merchantSettlementAtomic: '99000000', gatewayFeeAtomic: '1000000', reference: 'REFERENCE', requiredCommitment: 'finalized' as const };
  const observed = { signature: 'SIGNATURE', success: true, commitment: 'confirmed' as const, feePayer: 'CUSTOMER', referenceMatched: true, transfers: [] };
  assert.equal(verifyPaymentTransaction(expected, observed).reason, 'COMMITMENT_TOO_LOW');
});

test('duplicate blockchain signatures are never re-recognized as revenue', () => {
  const expected = { amountAtomic: '100000000', asset: 'USDC' as const, tokenMint: 'USDC_MINT', tokenProgram: 'spl-token' as const, tokenDecimals: 6, merchantDestination: 'MERCHANT', feeDestination: 'SOLMINT', merchantSettlementAtomic: '99000000', gatewayFeeAtomic: '1000000', reference: 'REFERENCE', requiredCommitment: 'finalized' as const };
  const observed = { signature: 'SAME', success: true, commitment: 'finalized' as const, feePayer: 'CUSTOMER', referenceMatched: true, transfers: [] };
  assert.equal(verifyPaymentTransaction(expected, observed, true).reason, 'DUPLICATE_SIGNATURE');
});
