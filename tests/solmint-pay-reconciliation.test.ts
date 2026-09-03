import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcilePayment, type ReconciliationPayment, type ReconciliationRepository } from '../src/pay/services/reconciliationEngine';
import { transactionContainsReference } from '../src/pay/services/solanaRpcProvider';
import type { ObservedPaymentTransaction, ObservedTransfer } from '../src/pay/services/verificationPolicy';

const payment: ReconciliationPayment = {
  id: 'pay-1', merchantId: 'merchant-1', createdAt: new Date(Date.now() - 60_000).toISOString(), amountAtomic: '1000000000', customerTotalAtomic: '1000000000',
  merchantSettlementAtomic: '990000000', gatewayFeeAtomic: '10000000', asset: 'SOL', tokenMint: null,
  tokenProgram: null, tokenDecimals: null, recipient: 'Merchant1111111111111111111111111111111111',
  feeRecipient: 'Gateway111111111111111111111111111111111', reference: 'Reference111111111111111111111111111111111',
  verificationCommitment: 'finalized', expiresAt: new Date(Date.now() + 60_000).toISOString(), status: 'pending',
};

function transfer(destination: string, amountAtomic: string, sourceAuthority = 'Customer111111111111111111111111111111111'): ObservedTransfer {
  return { role: 'other', source: sourceAuthority, sourceAuthority, destination, destinationAuthority: destination, asset: 'SOL', tokenMint: null, tokenProgram: null, tokenDecimals: null, amountAtomic, instructionIndex: 0 };
}

function validObservation(signature: string, merchantAmount = payment.merchantSettlementAtomic, feeAmount = payment.gatewayFeeAtomic): ObservedPaymentTransaction {
  return { signature, slot: 10, blockTime: new Date().toISOString(), networkFeeLamports: '5000', success: true, commitment: 'finalized', feePayer: 'Customer111111111111111111111111111111111', referenceMatched: true, transfers: [transfer(payment.recipient, merchantAmount), transfer(payment.feeRecipient, feeAmount)] };
}

class FakeProvider {
  public window: { createdAt: string; expiresAt: string } | undefined;
  constructor(private readonly observations: readonly ObservedPaymentTransaction[], private readonly fail = false) {}
  async findTransactionsByReference(_reference: string, _commitment: 'confirmed' | 'finalized', window?: { createdAt: string; expiresAt: string }): Promise<readonly ObservedPaymentTransaction[]> { this.window = window; if (this.fail) throw new Error('REFERENCE_DISCOVERY_INCOMPLETE'); return this.observations; }
  async getTransaction(signature: string): Promise<ObservedPaymentTransaction | null> { return this.observations.find((x) => x.signature === signature) || null; }
  async getHealth(): Promise<{ ok: boolean; slot: number | null; provider: string }> { return { ok: true, slot: 10, provider: 'fake' }; }
}

class FakeRepository implements ReconciliationRepository {
  applied: unknown[] = [];
  rejected: unknown[] = [];
  expired = false;
  outcomes: string[] = [];
  async loadKnownSignatures(): Promise<ReadonlySet<string>> { return new Set(); }
  async prepareVerification(): Promise<'ready' | 'stale'> { return 'ready'; }
  async recordRejectedObservation(paymentId: string, observation: ObservedPaymentTransaction, reason: string): Promise<void> { this.rejected.push({ paymentId, observation, reason }); }
  async recordOutcome(_paymentId: string, status: 'underpaid' | 'overpaid' | 'ambiguous'): Promise<'recorded' | 'stale'> { this.outcomes.push(status); return 'recorded'; }
  async applyVerifiedObservation(input: { payment: ReconciliationPayment; observation: ObservedPaymentTransaction; transfers: readonly ObservedTransfer[] }): Promise<'confirmed' | 'duplicate' | 'stale'> { this.applied.push(input); return 'confirmed'; }
  async expirePayment(): Promise<'expired' | 'stale'> { this.expired = true; return 'expired'; }
}

class AtomicRaceRepository implements ReconciliationRepository {
  private readonly seenSignatures = new Set<string>();
  private calls = 0;
  private releaseBarrier: (() => void) | null = null;
  private readonly barrier = new Promise<void>((resolve) => { this.releaseBarrier = resolve; });
  private readonly appliedResults: Array<'confirmed' | 'duplicate' | 'stale'> = [];
  get results(): readonly ('confirmed' | 'duplicate' | 'stale')[] { return this.appliedResults; }
  async loadKnownSignatures(): Promise<ReadonlySet<string>> { return new Set(); }
  async prepareVerification(): Promise<'ready' | 'stale'> { return 'ready'; }
  async recordRejectedObservation(): Promise<void> {}
  async recordOutcome(): Promise<'recorded' | 'stale'> { return 'recorded'; }
  async expirePayment(): Promise<'expired' | 'stale'> { return 'stale'; }
  async applyVerifiedObservation(input: { payment: ReconciliationPayment; observation: ObservedPaymentTransaction; transfers: readonly ObservedTransfer[] }): Promise<'confirmed' | 'duplicate' | 'stale'> {
    this.calls += 1;
    if (this.calls === 1) await this.barrier;
    else if (this.calls === 2) this.releaseBarrier?.();
    if (this.seenSignatures.has(input.observation.signature)) {
      this.appliedResults.push('duplicate');
      return 'duplicate';
    }
    this.seenSignatures.add(input.observation.signature);
    this.appliedResults.push('confirmed');
    return 'confirmed';
  }
}

test('reference helper requires reference in transaction account keys', () => {
  const reference = payment.reference;
  assert.equal(transactionContainsReference({ transaction: { message: { accountKeys: [{ pubkey: reference }] } } }, reference), true);
  assert.equal(transactionContainsReference({ transaction: { message: { accountKeys: [{ pubkey: 'other' }] } } }, reference), false);
});

test('reconciliation passes the payment creation/expiry window to reference discovery', async () => {
  const provider = new FakeProvider([validObservation('sig-1')]);
  const repository = new FakeRepository();
  const result = await reconcilePayment(provider, repository, payment);
  assert.equal(result.outcome, 'confirmed');
  assert.deepEqual(provider.window, { createdAt: payment.createdAt, expiresAt: payment.expiresAt });
});

test('reconciliation labels verified legs from immutable payment expectations, not provider roles', async () => {
  const provider = new FakeProvider([validObservation('sig-1')]);
  const repository = new FakeRepository();
  const result = await reconcilePayment(provider, repository, payment);
  assert.equal(result.outcome, 'confirmed');
  const applied = repository.applied[0] as { transfers: readonly ObservedTransfer[] };
  assert.equal(applied.transfers.find((x) => x.destination === payment.recipient)?.role, 'merchant_settlement');
  assert.equal(applied.transfers.find((x) => x.destination === payment.feeRecipient)?.role, 'gateway_fee');
});

test('underpayment is preserved as a retryable business outcome', async () => {
  const provider = new FakeProvider([validObservation('sig-under', payment.merchantSettlementAtomic.slice(0, -1) + '9')]);
  const repository = new FakeRepository();
  const result = await reconcilePayment(provider, repository, payment);
  assert.equal(result.outcome, 'underpaid');
  assert.deepEqual(repository.outcomes, ['underpaid']);
});

test('overpayment is preserved as a distinct business outcome', async () => {
  const overpaid = (BigInt(payment.merchantSettlementAtomic) + 1n).toString();
  const provider = new FakeProvider([validObservation('sig-over', overpaid)]);
  const repository = new FakeRepository();
  const result = await reconcilePayment(provider, repository, payment);
  assert.equal(result.outcome, 'overpaid');
  assert.deepEqual(repository.outcomes, ['overpaid']);
});

test('ambiguous candidates are never collapsed into no_match', async () => {
  const provider = new FakeProvider([validObservation('sig-a'), validObservation('sig-b')]);
  const repository = new FakeRepository();
  const result = await reconcilePayment(provider, repository, payment);
  assert.equal(result.outcome, 'ambiguous');
  assert.deepEqual(repository.outcomes, ['ambiguous']);
});

test('ambiguous payment can re-enter verification after state transition', async () => {
  const provider = new FakeProvider([validObservation('sig-retry')]);
  const repository = new FakeRepository();
  const ambiguousPayment = { ...payment, status: 'ambiguous' as const };
  const result = await reconcilePayment(provider, repository, ambiguousPayment);
  assert.equal(result.outcome, 'confirmed');
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

test('incomplete reference discovery fails closed instead of becoming no_match', async () => {
  const provider = new FakeProvider([], true);
  const repository = new FakeRepository();
  const result = await reconcilePayment(provider, repository, payment);
  assert.equal(result.outcome, 'provider_unavailable');
  assert.equal(repository.applied.length, 0);
  assert.equal(repository.rejected.length, 0);
});

test('two concurrent reconciliation workers recognize one signature exactly once', async () => {
  const provider = new FakeProvider([validObservation('sig-race')]);
  const repository = new AtomicRaceRepository();
  const [first, second] = await Promise.all([
    reconcilePayment(provider, repository, payment),
    reconcilePayment(provider, repository, payment),
  ]);

  const outcomes = [first.outcome, second.outcome].sort();
  assert.deepEqual(outcomes, ['confirmed', 'duplicate']);
  assert.deepEqual([...repository.results].sort(), ['confirmed', 'duplicate']);
});
