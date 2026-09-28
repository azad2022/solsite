import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Connection } from '@solana/web3.js';
import test from 'node:test';
import { reconcilePayment, type ReconciliationPayment, type ReconciliationRepository } from '../src/pay/services/reconciliationEngine';
import { createSolanaRpcProvider } from '../src/pay/services/solanaRpcProvider';
import type { ObservedPaymentTransaction, ObservedTransfer } from '../src/pay/services/verificationPolicy';

const DEVNET_RPC_URL = process.env.SOLANA_RPC_URL?.trim();
if (!DEVNET_RPC_URL) throw new Error('SOLANA_RPC_URL is required for the funded Devnet Payment Intent lifecycle E2E.');
if (!DEVNET_RPC_URL.startsWith('https://')) throw new Error('SOLANA_RPC_URL must use HTTPS for the funded Devnet Payment Intent lifecycle E2E.');

const DEVNET_PAYMENT_FIXTURE_PATH = process.env.DEVNET_PAYMENT_FIXTURE_PATH?.trim() || '/tmp/solmint-pay-devnet-fixture.json';
const OBSERVATION_POLL_ATTEMPTS = 20;
const OBSERVATION_POLL_DELAY_MS = 2_000;

async function waitForFinalizedObservation(
  provider: ReturnType<typeof createSolanaRpcProvider>,
  signature: string,
): Promise<NonNullable<Awaited<ReturnType<typeof provider.getTransaction>>>> {
  for (let attempt = 1; attempt <= OBSERVATION_POLL_ATTEMPTS; attempt += 1) {
    const observation = await provider.getTransaction(signature, 'finalized');
    if (observation) return observation;
    if (attempt < OBSERVATION_POLL_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, OBSERVATION_POLL_DELAY_MS));
  }
  throw new Error('FINALIZED_TRANSACTION_OBSERVATION_TIMEOUT after ' + OBSERVATION_POLL_ATTEMPTS + ' attempts');
}

class MemoryReconciliationRepository implements ReconciliationRepository {
  readonly knownSignatures = new Set<string>();
  readonly rejected: Array<{ signature: string; reason: string }> = [];
  readonly applied: Array<{ signature: string; status: string }> = [];
  status: ReconciliationPayment['status'];

  constructor(initialStatus: ReconciliationPayment['status']) {
    this.status = initialStatus;
  }

  async loadKnownSignatures(): Promise<ReadonlySet<string>> {
    return new Set(this.knownSignatures);
  }

  async prepareVerification(): Promise<'ready' | 'stale'> {
    this.status = 'pending';
    return 'ready';
  }

  async recordRejectedObservation(_paymentId: string, observation: ObservedPaymentTransaction, reason: string): Promise<void> {
    this.rejected.push({ signature: observation.signature, reason });
  }

  async recordOutcome(_paymentId: string, status: 'underpaid' | 'overpaid' | 'ambiguous' | 'failed' | 'wrong_recipient'): Promise<'recorded' | 'stale'> {
    this.status = status;
    return 'recorded';
  }

  async applyVerifiedObservation(input: { payment: ReconciliationPayment; observation: ObservedPaymentTransaction; transfers: readonly ObservedTransfer[] }): Promise<'confirmed' | 'duplicate' | 'stale'> {
    if (this.knownSignatures.has(input.observation.signature)) return 'duplicate';
    this.knownSignatures.add(input.observation.signature);
    this.status = 'confirmed';
    this.applied.push({ signature: input.observation.signature, status: 'confirmed' });
    assert.equal(input.transfers.filter((transfer) => transfer.role === 'merchant_settlement').length, 1);
    assert.equal(input.transfers.filter((transfer) => transfer.role === 'gateway_fee').length, 1);
    return 'confirmed';
  }

  async expirePayment(): Promise<'expired' | 'stale'> {
    this.status = 'expired';
    return 'expired';
  }
}

test('SolMint Pay Payment Intent reconciliation reuses the real Devnet transaction and rejects replay', { timeout: 300_000 }, async () => {
  const fixture = JSON.parse(readFileSync(DEVNET_PAYMENT_FIXTURE_PATH, 'utf8')) as {
    signature?: string;
    merchantDestination?: string;
    feeDestination?: string;
    reference?: string;
    paymentAmountLamports?: string;
    merchantSettlementLamports?: string;
    gatewayFeeLamports?: string;
    createdAt?: string;
    expiresAt?: string;
  };

  for (const [key, value] of Object.entries(fixture)) {
    assert.equal(typeof value, 'string', 'Devnet payment fixture field ' + key + ' must be a string.');
  }

  const requireFixtureString = (value: string | undefined, field: string): string => {
    assert.equal(typeof value, 'string', 'Devnet payment fixture field ' + field + ' is required and must be a string.');
    assert.ok(value.length > 0, 'Devnet payment fixture field ' + field + ' must not be empty.');
    return value;
  };

  const signature = requireFixtureString(fixture.signature, 'signature');
  const merchantDestination = requireFixtureString(fixture.merchantDestination, 'merchantDestination');
  const feeDestination = requireFixtureString(fixture.feeDestination, 'feeDestination');
  const reference = requireFixtureString(fixture.reference, 'reference');
  const paymentAmountLamports = requireFixtureString(fixture.paymentAmountLamports, 'paymentAmountLamports');
  const merchantSettlementLamports = requireFixtureString(fixture.merchantSettlementLamports, 'merchantSettlementLamports');
  const gatewayFeeLamports = requireFixtureString(fixture.gatewayFeeLamports, 'gatewayFeeLamports');
  const createdAt = requireFixtureString(fixture.createdAt, 'createdAt');
  const expiresAt = requireFixtureString(fixture.expiresAt, 'expiresAt');

  const provider = createSolanaRpcProvider({ SOLANA_RPC_URL: DEVNET_RPC_URL });
  const observation = await waitForFinalizedObservation(provider, signature);
  assert.equal(observation.success, true);
  assert.equal(observation.commitment, 'finalized');

  const payment: ReconciliationPayment = {
    id: crypto.randomUUID(),
    merchantId: crypto.randomUUID(),
    createdAt,
    amountAtomic: paymentAmountLamports,
    customerTotalAtomic: paymentAmountLamports,
    merchantSettlementAtomic: merchantSettlementLamports,
    gatewayFeeAtomic: gatewayFeeLamports,
    asset: 'SOL',
    tokenMint: null,
    tokenProgram: null,
    tokenDecimals: null,
    recipient: merchantDestination,
    feeRecipient: feeDestination,
    reference,
    verificationCommitment: 'finalized',
    expiresAt,
    status: 'pending',
  };

  const repository = new MemoryReconciliationRepository(payment.status);
  const first = await reconcilePayment(provider, repository, payment, signature);
  assert.equal(first.outcome, 'confirmed');
  assert.equal(first.verification?.result.reason, 'OK');
  assert.equal(first.verification?.result.status, 'confirmed');
  assert.equal(repository.status, 'confirmed');
  assert.deepEqual(repository.applied, [{ signature, status: 'confirmed' }]);

  const replay = await reconcilePayment(provider, repository, { ...payment, status: 'confirmed' }, signature);
  assert.equal(replay.outcome, 'duplicate');
  assert.equal(replay.verification?.result.reason, 'DUPLICATE_SIGNATURE');
  assert.equal(repository.applied.length, 1);

  const window = { createdAt, expiresAt };
  const discovered = await provider.findTransactionsByReference(reference, 'finalized', window);
  assert.ok(discovered.some((candidate) => candidate.signature === signature));
  assert.equal(BigInt(payment.amountAtomic), BigInt(payment.merchantSettlementAtomic) + BigInt(payment.gatewayFeeAtomic));
  console.log('PAYMENT_INTENT_DEVNET_RECONCILIATION_REUSED_REAL_TRANSACTION ' + signature);
});
