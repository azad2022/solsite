import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcilePayment, type ReconciliationPayment, type ReconciliationRepository } from '../src/pay/services/reconciliationEngine';
import { transactionContainsReference } from '../src/pay/services/solanaRpcProvider';
import type { ObservedPaymentTransaction, ObservedTransfer } from '../src/pay/services/verificationPolicy';

const payment: ReconciliationPayment = {
  id: 'pay-1', merchantId: 'merchant-1', amountAtomic: '1000000000', customerTotalAtomic: '1000000000',
  merchantSettlementAtomic: '990000000', gatewayFeeAtomic: '10000000', asset: 'SOL', tokenMint: null,
  tokenProgram: null, tokenDecimals: null, recipient: 'Merchant1111111111111111111111111111111111',
  feeRecipient: 'Gateway111111111111111111111111111111111', reference: 'Reference111111111111111111111111111111111',
  verificationCommitment: 'finalized', expiresAt: new Date(Date.now() + 60_000).toISOString(), status: 'pending',
};

function transfer(destination: string, amountAtomic: string, sourceAuthority = 'Customer111111111111111111111111111111111'): ObservedTransfer {
  return {
    role: 'other', source: sourceAuthority, sourceAuthority, destination, destinationAuthority: destination,
    asset: 'SOL', tokenMint: null, tokenProgram: null, tokenDecimals: null, amountAtomic, instructionIndex: 0,
  };
}

function validObservation(signature: string): ObservedPaymentTransaction {
  return {
    signature, slot: 10, blockTime: new Date().toISOString(), networkFeeLamports: '5000', success: true,
    commitment: 'finalized', feePayer: 'Customer111111111111111111111111111111111', referenceMatched: true,
    transfers: [transfer(payment.recipient, payment.merchantSettlementAtomic), transfer(payment.feeRecipient, payment.gatewayFeeAtomic)],
  };
}

class FakeProvider {
  constructor(private readonly observations: readonly ObservedPaymentTransaction[]) {}
  async findTransactionsByReference(): Promise<readonly ObservedPaymentTransaction[]> { return this.observations; }
  async getTransaction(signature: string): Promise<ObservedPaymentTransaction | null> { return this.observations.find((x) => x.signature === signature) || null; }
}

class FakeRepository implements ReconciliationRepository {
  applied: unknown[] = [];
  rejected: unknown[] = [];
  expired = false;
  async loadKnownSignatures(): Promise<ReadonlySet<string>> { return new Set(); }
  async recordRejectedObservation(paymentId: string, observation: ObservedPaymentTransaction, reason: string): Promise<void> { this.rejected.push({ paymentId, observation, reason }); }
  async applyVerifiedObservation(input: { payment: ReconciliationPayment; observation: ObservedPaymentTransaction; transfers: readonly ObservedTransfer[] }): Promise<'confirmed' | 'duplicate' | 'stale'> { this.applied.push(input); return 'confirmed'; }
  async expirePayment(): Promise<'expired' | 'stale'> { this.expired = true; return 'expired'; }
}

test('reference helper requires reference in transaction account keys', () => {
  const reference = payment.reference;
  assert.equal(transactionContainsReference({ transaction: { message: { accountKeys: [{ pubkey: reference }] } } }, reference), true);
  assert.equal(transactionContainsReference({ transaction: { message: { accountKeys: [{ pubkey: 'other' }] } } }, reference), false);
});

test('reconciliation labels verified legs from immutable payment expectations, not provider roles', async () => {
  const provider = new FakeProvider([validObservation('sig-1')]);
  const repository = new FakeRepository();
  const result = await reconcilePayment(provider, repository, payment);
  assert.equal(result.outcome, 'confirmed');
  assert.equal(repository.applied.length, 1);
  const applied = repository.applied[0] as { transfers: readonly ObservedTransfer[] };
  assert.equal(applied.transfers.find((x) => x.destination === payment.recipient)?.role, 'merchant_settlement');
  assert.equal(applied.transfers.find((x) => x.destination === payment.feeRecipient)?.role, 'gateway_fee');
});

test('expired payment is never sent to blockchain verification', async () => {
  const expiredPayment = { ...payment, expiresAt: new Date(Date.now() - 1).toISOString() };
  const provider = new FakeProvider([validObservation('sig-expired')]);
  const repository = new FakeRepository();
  const result = await reconcilePayment(provider, repository, expiredPayment);
  assert.equal(result.outcome, 'expired');
  assert.equal(repository.expired, true);
  assert.equal(repository.applied.length, 0);
});
