import assert from 'node:assert/strict';
import test from 'node:test';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  deriveSubscriptionCycleIdentity,
  SubscriptionCycleIdentityError,
} from '../src/pay/services/subscriptionCycleIdentity';

const PROGRAM_ID = Keypair.generate().publicKey;
const [SUBSCRIPTION_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('subscription-cycle-test')],
  PROGRAM_ID,
);
assert.equal(PublicKey.isOnCurve(SUBSCRIPTION_PDA.toBytes()), false);

test('derives Cycle identity from Subscription PDA and actual on-chain period start', () => {
  const cycle = deriveSubscriptionCycleIdentity({
    subscriptionPda: SUBSCRIPTION_PDA.toBase58(),
    currentPeriodStartTs: '1800000000',
  });

  assert.equal(cycle.subscriptionPda, SUBSCRIPTION_PDA.toBase58());
  assert.equal(cycle.currentPeriodStartTs, '1800000000');
  assert.equal(cycle.value, `${SUBSCRIPTION_PDA.toBase58()}:1800000000`);
});

test('same Subscription PDA and same on-chain period start produce the same Cycle key', () => {
  const first = deriveSubscriptionCycleIdentity({
    subscriptionPda: SUBSCRIPTION_PDA.toBase58(),
    currentPeriodStartTs: '1800000000',
  });
  const replay = deriveSubscriptionCycleIdentity({
    subscriptionPda: SUBSCRIPTION_PDA.toBase58(),
    currentPeriodStartTs: '1800000000',
  });

  assert.equal(first.value, replay.value);
});

test('period rollover creates a different Cycle key without calendar calculations', () => {
  const first = deriveSubscriptionCycleIdentity({
    subscriptionPda: SUBSCRIPTION_PDA.toBase58(),
    currentPeriodStartTs: '1800000000',
  });
  const next = deriveSubscriptionCycleIdentity({
    subscriptionPda: SUBSCRIPTION_PDA.toBase58(),
    currentPeriodStartTs: '1802592000',
  });

  assert.notEqual(first.value, next.value);
  assert.equal(next.currentPeriodStartTs, '1802592000');
});

test('rejects invalid and non-canonical Subscription addresses', () => {
  for (const subscriptionPda of ['', ' ', 'not-a-pda', '11111111111111111111111111111111']) {
    assert.throws(
      () => deriveSubscriptionCycleIdentity({ subscriptionPda, currentPeriodStartTs: '1' }),
      SubscriptionCycleIdentityError,
    );
  }
});

test('rejects negative, fractional, signed, leading-zero and malformed period starts', () => {
  for (const currentPeriodStartTs of ['-1', '1.5', '+1', '01', ' 1', '']) {
    assert.throws(
      () => deriveSubscriptionCycleIdentity({ subscriptionPda: SUBSCRIPTION_PDA.toBase58(), currentPeriodStartTs }),
      (error: unknown) =>
        error instanceof SubscriptionCycleIdentityError &&
        error.code === 'INVALID_PERIOD_START',
    );
  }
});

test('rejects period starts outside the positive i64 range', () => {
  assert.throws(
    () => deriveSubscriptionCycleIdentity({
      subscriptionPda: SUBSCRIPTION_PDA.toBase58(),
      currentPeriodStartTs: (1n << 63n).toString(),
    }),
    (error: unknown) =>
      error instanceof SubscriptionCycleIdentityError &&
      error.code === 'PERIOD_START_OUT_OF_RANGE',
  );
});
