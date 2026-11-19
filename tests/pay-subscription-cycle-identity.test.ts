import assert from 'node:assert/strict';
import test from 'node:test';
import { Keypair } from '@solana/web3.js';
import {
  deriveSubscriptionCycleIdentity,
  SubscriptionCycleIdentityError,
} from '../src/pay/services/subscriptionCycleIdentity';

const SUBSCRIPTION_PDA = Keypair.generate().publicKey.toBase58();

test('derives Cycle identity from Subscription PDA and actual on-chain period start', () => {
  const cycle = deriveSubscriptionCycleIdentity({
    subscriptionPda: SUBSCRIPTION_PDA,
    currentPeriodStartTs: '1800000000',
  });

  assert.equal(cycle.subscriptionPda, SUBSCRIPTION_PDA);
  assert.equal(cycle.currentPeriodStartTs, '1800000000');
  assert.equal(cycle.value, `${SUBSCRIPTION_PDA}:1800000000`);
});

test('same Subscription PDA and same on-chain period start produce the same Cycle key', () => {
  const first = deriveSubscriptionCycleIdentity({
    subscriptionPda: SUBSCRIPTION_PDA,
    currentPeriodStartTs: '1800000000',
  });
  const replay = deriveSubscriptionCycleIdentity({
    subscriptionPda: SUBSCRIPTION_PDA,
    currentPeriodStartTs: '1800000000',
  });

  assert.equal(first.value, replay.value);
});

test('period rollover creates a different Cycle key without calendar calculations', () => {
  const first = deriveSubscriptionCycleIdentity({
    subscriptionPda: SUBSCRIPTION_PDA,
    currentPeriodStartTs: '1800000000',
  });
  const next = deriveSubscriptionCycleIdentity({
    subscriptionPda: SUBSCRIPTION_PDA,
    currentPeriodStartTs: '1802592000',
  });

  assert.notEqual(first.value, next.value);
  assert.equal(next.currentPeriodStartTs, '1802592000');
});

test('rejects invalid and non-canonical Subscription PDAs', () => {
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
      () => deriveSubscriptionCycleIdentity({ subscriptionPda: SUBSCRIPTION_PDA, currentPeriodStartTs }),
      (error: unknown) =>
        error instanceof SubscriptionCycleIdentityError &&
        error.code === 'INVALID_PERIOD_START',
    );
  }
});

test('rejects period starts outside the positive i64 range', () => {
  assert.throws(
    () => deriveSubscriptionCycleIdentity({
      subscriptionPda: SUBSCRIPTION_PDA,
      currentPeriodStartTs: (1n << 63n).toString(),
    }),
    (error: unknown) =>
      error instanceof SubscriptionCycleIdentityError &&
      error.code === 'PERIOD_START_OUT_OF_RANGE',
  );
});
