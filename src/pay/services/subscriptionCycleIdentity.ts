import { PublicKey } from '@solana/web3.js';

/**
 * Canonical identity for one on-chain Subscription billing period.
 *
 * currentPeriodStartTs MUST come from the same finalized Subscription account
 * snapshot used by the trusted server-side caller. Scheduler/calendar time is
 * never a valid input. This helper does not perform RPC or claim a DB Cycle.
 */
export interface SubscriptionCycleIdentityInput {
  subscriptionPda: string;
  currentPeriodStartTs: string;
}

export interface SubscriptionCycleIdentity {
  subscriptionPda: string;
  currentPeriodStartTs: string;
  /** Stable exact key: "<Subscription PDA>:<on-chain current_period_start_ts>". */
  value: string;
}

export type SubscriptionCycleIdentityErrorCode =
  | 'INVALID_SUBSCRIPTION_PDA'
  | 'INVALID_PERIOD_START'
  | 'PERIOD_START_OUT_OF_RANGE';

export class SubscriptionCycleIdentityError extends Error {
  constructor(
    public readonly code: SubscriptionCycleIdentityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SubscriptionCycleIdentityError';
  }
}

const ZERO_ADDRESS = '11111111111111111111111111111111';
const I64_MAX = (1n << 63n) - 1n;

export function deriveSubscriptionCycleIdentity(
  input: SubscriptionCycleIdentityInput,
): SubscriptionCycleIdentity {
  if (
    typeof input.subscriptionPda !== 'string' ||
    input.subscriptionPda.trim() !== input.subscriptionPda ||
    input.subscriptionPda.length === 0
  ) {
    throw new SubscriptionCycleIdentityError(
      'INVALID_SUBSCRIPTION_PDA',
      'Subscription PDA must be a canonical non-empty Solana address.',
    );
  }

  let subscriptionPda: string;
  try {
    subscriptionPda = new PublicKey(input.subscriptionPda).toBase58();
  } catch {
    throw new SubscriptionCycleIdentityError(
      'INVALID_SUBSCRIPTION_PDA',
      'Subscription PDA is not a valid 32-byte Solana address.',
    );
  }
  if (subscriptionPda !== input.subscriptionPda || subscriptionPda === ZERO_ADDRESS) {
    throw new SubscriptionCycleIdentityError(
      'INVALID_SUBSCRIPTION_PDA',
      'Subscription PDA must use its canonical Base58 representation.',
    );
  }

  if (
    typeof input.currentPeriodStartTs !== 'string' ||
    !/^(0|[1-9][0-9]*)$/.test(input.currentPeriodStartTs)
  ) {
    throw new SubscriptionCycleIdentityError(
      'INVALID_PERIOD_START',
      'On-chain current_period_start_ts must be a canonical unsigned decimal string.',
    );
  }

  const periodStart = BigInt(input.currentPeriodStartTs);
  if (periodStart > I64_MAX) {
    throw new SubscriptionCycleIdentityError(
      'PERIOD_START_OUT_OF_RANGE',
      'On-chain current_period_start_ts exceeds the positive i64 range.',
    );
  }

  return {
    subscriptionPda,
    currentPeriodStartTs: periodStart.toString(),
    value: `${subscriptionPda}:${periodStart.toString()}`,
  };
}
