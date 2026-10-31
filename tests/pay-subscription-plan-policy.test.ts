import assert from 'node:assert/strict';
import test from 'node:test';
import { Keypair, PublicKey } from '@solana/web3.js';
import type { SupportedAssetConfig } from '../src/pay/services/assetPolicy';
import {
  SUBSCRIPTION_MAX_DESTINATIONS,
  SUBSCRIPTION_MAX_PERIOD_HOURS,
  SUBSCRIPTION_MAX_PULLERS,
  SUBSCRIPTION_PROGRAM_ID_V050,
  SubscriptionPlanPolicyError,
  validateSubscriptionPlanPolicy,
} from '../src/pay/services/subscriptionPlanPolicy';

const MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const ASSET: SupportedAssetConfig = {
  asset: 'USDC',
  tokenMint: MINT,
  tokenProgram: 'spl-token',
  decimals: 6,
};
const OWNER = Keypair.generate().publicKey.toBase58();
const DESTINATIONS = Array.from({ length: 4 }, () => Keypair.generate().publicKey.toBase58());
const PULLERS = Array.from({ length: 4 }, () => Keypair.generate().publicKey.toBase58());

function input(overrides: Partial<Parameters<typeof validateSubscriptionPlanPolicy>[0]> = {}) {
  return {
    planId: '0',
    amountAtomic: '1000000',
    periodHours: '720',
    endTs: '0',
    ownerAddress: OWNER,
    destinationOwners: [DESTINATIONS[0]],
    authorizedPullers: [],
    metadataUri: 'https://solmint.ir/pay/plans/plan-0.json',
    asset: ASSET,
    chainTimeUnixSeconds: '1793380000',
    ...overrides,
  };
}

function expectPolicyError(
  overrides: Partial<Parameters<typeof validateSubscriptionPlanPolicy>[0]>,
  code: SubscriptionPlanPolicyError['code'],
) {
  assert.throws(
    () => validateSubscriptionPlanPolicy(input(overrides)),
    (error: unknown) => error instanceof SubscriptionPlanPolicyError && error.code === code,
  );
}

test('pinned Program ID is a valid canonical Solana address', () => {
  assert.equal(new PublicKey(SUBSCRIPTION_PROGRAM_ID_V050).toBase58(), SUBSCRIPTION_PROGRAM_ID_V050);
});

test('accepts a server-resolved original SPL USDC plan with explicit destination allowlist', () => {
  const result = validateSubscriptionPlanPolicy(input());
  assert.equal(result.planId, '0');
  assert.equal(result.amountAtomic, '1000000');
  assert.equal(result.periodHours, '720');
  assert.equal(result.asset.tokenProgram, 'spl-token');
  assert.deepEqual(result.destinationOwners, [DESTINATIONS[0]]);
});

test('accepts upstream maximum period and exact one-period finite end boundary', () => {
  const chainTime = 1_793_380_000n;
  const period = SUBSCRIPTION_MAX_PERIOD_HOURS;
  const result = validateSubscriptionPlanPolicy(input({
    periodHours: period.toString(),
    endTs: (chainTime + period * 3_600n).toString(),
    chainTimeUnixSeconds: chainTime.toString(),
  }));
  assert.equal(result.periodHours, '8760');
});

test('rejects a finite Plan end one second shorter than one complete period', () => {
  const chainTime = 1_793_380_000n;
  expectPolicyError({
    endTs: (chainTime + 720n * 3_600n - 1n).toString(),
    chainTimeUnixSeconds: chainTime.toString(),
  }, 'INVALID_END_TS');
});

test('rejects zero and out-of-range billing periods', () => {
  expectPolicyError({ periodHours: '0' }, 'INVALID_PERIOD');
  expectPolicyError({ periodHours: '8761' }, 'INVALID_PERIOD');
});

test('rejects fractional, signed, non-canonical and over-u64 amounts', () => {
  for (const amountAtomic of ['1.5', '-1', '+1', '01', (1n << 64n).toString()]) {
    expectPolicyError({ amountAtomic }, 'INVALID_AMOUNT');
  }
});

test('rejects a zero amount but allows plan identifier zero', () => {
  expectPolicyError({ amountAtomic: '0' }, 'INVALID_AMOUNT');
  assert.equal(validateSubscriptionPlanPolicy(input({ planId: '0' })).planId, '0');
});

test('rejects SOL, Token-2022, and unconfigured assets for Subscription v1', () => {
  expectPolicyError({ asset: { asset: 'SOL', tokenMint: null, tokenProgram: null, decimals: null } }, 'INVALID_ASSET');
  expectPolicyError({ asset: { ...ASSET, tokenProgram: 'token-2022' } }, 'INVALID_ASSET');
  expectPolicyError({ asset: { ...ASSET, tokenMint: null } }, 'INVALID_ASSET');
});

test('rejects a destination list that is empty, zero-address-only, or over Program capacity', () => {
  expectPolicyError({ destinationOwners: [] }, 'INVALID_DESTINATIONS');
  expectPolicyError({ destinationOwners: ['11111111111111111111111111111111'] }, 'INVALID_DESTINATIONS');
  expectPolicyError({
    destinationOwners: [...DESTINATIONS, Keypair.generate().publicKey.toBase58()],
  }, 'INVALID_DESTINATIONS');
});

test('rejects duplicate canonical destination and puller addresses', () => {
  expectPolicyError({ destinationOwners: [DESTINATIONS[0], DESTINATIONS[0]] }, 'INVALID_DESTINATIONS');
  expectPolicyError({ authorizedPullers: [PULLERS[0], PULLERS[0]] }, 'INVALID_PULLERS');
});

test('accepts up to the Program maximum additional pullers', () => {
  assert.equal(validateSubscriptionPlanPolicy(input({ authorizedPullers: PULLERS })).authorizedPullers.length, SUBSCRIPTION_MAX_PULLERS);
  expectPolicyError({ authorizedPullers: [...PULLERS, Keypair.generate().publicKey.toBase58()] }, 'INVALID_PULLERS');
});

test('rejects malformed, non-canonical and zero addresses', () => {
  expectPolicyError({ ownerAddress: 'not-a-solana-address' }, 'INVALID_ADDRESS');
  expectPolicyError({ ownerAddress: '11111111111111111111111111111111' }, 'INVALID_ADDRESS');
});

test('rejects metadata URI that exceeds the Program byte limit, including UTF-8 multibyte text', () => {
  expectPolicyError({ metadataUri: 'x'.repeat(129) }, 'INVALID_METADATA_URI');
  expectPolicyError({ metadataUri: 'م'.repeat(65) }, 'INVALID_METADATA_URI');
});

test('rejects invalid chain time and signed or non-canonical plan identifiers', () => {
  expectPolicyError({ chainTimeUnixSeconds: '-1' }, 'INVALID_CHAIN_TIME');
  expectPolicyError({ planId: '01' }, 'INVALID_PLAN_ID');
  expectPolicyError({ planId: (1n << 64n).toString() }, 'INVALID_PLAN_ID');
});
