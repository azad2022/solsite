import { PublicKey } from '@solana/web3.js';
import type { SupportedAssetConfig } from './assetPolicy';

export const SUBSCRIPTION_PROGRAM_ID_V050 = 'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44' as const;
export const SUBSCRIPTION_PROGRAM_VERSION = '0.5.0' as const;
export const SUBSCRIPTION_MIN_PERIOD_HOURS = 1n;
export const SUBSCRIPTION_MAX_PERIOD_HOURS = 8_760n;
export const SUBSCRIPTION_MAX_DESTINATIONS = 4;
export const SUBSCRIPTION_MAX_PULLERS = 4;
export const SUBSCRIPTION_METADATA_URI_MAX_BYTES = 128;

const U64_MAX = (1n << 64n) - 1n;
const I64_MAX = (1n << 63n) - 1n;
const ZERO_ADDRESS = '11111111111111111111111111111111';
const textEncoder = new TextEncoder();

export type SubscriptionPlanPolicyErrorCode =
  | 'INVALID_PLAN_ID'
  | 'INVALID_AMOUNT'
  | 'INVALID_PERIOD'
  | 'INVALID_END_TS'
  | 'INVALID_CHAIN_TIME'
  | 'INVALID_ADDRESS'
  | 'INVALID_ASSET'
  | 'INVALID_DESTINATIONS'
  | 'INVALID_PULLERS'
  | 'INVALID_METADATA_URI';

export class SubscriptionPlanPolicyError extends Error {
  constructor(
    public readonly code: SubscriptionPlanPolicyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SubscriptionPlanPolicyError';
  }
}

export interface SubscriptionPlanPolicyInput {
  /** Decimal u64 string. Zero is a valid Plan identifier. */
  planId: string;
  /** Positive decimal u64 amount in the configured mint's atomic units. */
  amountAtomic: string;
  /** Fixed Program period in whole hours, decimal u64 string. */
  periodHours: string;
  /** Unix seconds as decimal i64 string. Zero means no finite Plan end. */
  endTs: string;
  /** Merchant's current active, verified receiving wallet, resolved server-side. */
  ownerAddress: string;
  /** Explicit destination token-account owner addresses resolved by trusted server policy. */
  destinationOwners: readonly string[];
  /** Additional authorized Puller addresses resolved by trusted server policy. Plan Owner is implicit. */
  authorizedPullers: readonly string[];
  /** UTF-8 metadata URI; upstream Program stores at most 128 bytes. */
  metadataUri: string;
  /** Must come from the existing server-side Pay asset policy, never from the request body. */
  asset: SupportedAssetConfig;
  /** Fresh cluster-derived Unix time in seconds, not browser time. */
  chainTimeUnixSeconds: string;
}

export interface ValidatedSubscriptionPlanPolicy {
  planId: string;
  amountAtomic: string;
  periodHours: string;
  endTs: string;
  ownerAddress: string;
  destinationOwners: string[];
  authorizedPullers: string[];
  metadataUri: string;
  asset: SupportedAssetConfig;
}

function fail(code: SubscriptionPlanPolicyErrorCode, message: string): never {
  throw new SubscriptionPlanPolicyError(code, message);
}

function parseUnsignedDecimal(
  value: string,
  code: SubscriptionPlanPolicyErrorCode,
  field: string,
  max = U64_MAX,
): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    return fail(code, `${field} must be a canonical unsigned decimal string.`);
  }

  const parsed = BigInt(value);
  if (parsed > max) return fail(code, `${field} exceeds its on-chain integer range.`);
  return parsed;
}

function canonicalAddress(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim() !== value || !value) {
    return fail('INVALID_ADDRESS', `${field} must be a non-empty canonical Solana address.`);
  }

  try {
    // PublicKey validates the decoded 32-byte representation and normalizes Base58.
    // Requiring exact round-trip rejects non-canonical textual representations.
    const address = new PublicKey(value);
    const canonical = address.toBase58();
    if (canonical !== value || canonical === ZERO_ADDRESS) {
      return fail('INVALID_ADDRESS', `${field} is not an allowed canonical Solana address.`);
    }
    return canonical;
  } catch (error) {
    if (error instanceof SubscriptionPlanPolicyError) throw error;
    return fail('INVALID_ADDRESS', `${field} is not a valid 32-byte Solana address.`);
  }
}

function validateAddressList(
  values: readonly string[],
  field: 'destinationOwners' | 'authorizedPullers',
  max: number,
): string[] {
  if (!Array.isArray(values) || values.length > max) {
    return fail(
      field === 'destinationOwners' ? 'INVALID_DESTINATIONS' : 'INVALID_PULLERS',
      `${field} must contain no more than ${max} addresses.`,
    );
  }

  const result = values.map((value, index) => {
    try {
      return canonicalAddress(value, `${field}[${index}]`);
    } catch (error) {
      if (error instanceof SubscriptionPlanPolicyError) {
        return fail(field === 'destinationOwners' ? 'INVALID_DESTINATIONS' : 'INVALID_PULLERS', error.message);
      }
      throw error;
    }
  });

  if (new Set(result).size !== result.length) {
    return fail(
      field === 'destinationOwners' ? 'INVALID_DESTINATIONS' : 'INVALID_PULLERS',
      `${field} must not contain duplicate addresses.`,
    );
  }

  if (field === 'destinationOwners' && result.length === 0) {
    return fail('INVALID_DESTINATIONS', 'Subscription Plans must have an explicit non-empty destination allowlist.');
  }

  return result;
}

/**
 * Validates only the pinned upstream Plan input and SolMint's conservative v1
 * asset/destination policy. It does not authorize a merchant, construct/sign a
 * transaction, or prove that an RPC snapshot is fresh; callers must resolve
 * the verified Merchant wallet and server asset policy before calling it.
 */
export function validateSubscriptionPlanPolicy(
  input: SubscriptionPlanPolicyInput,
): ValidatedSubscriptionPlanPolicy {
  const planId = parseUnsignedDecimal(input.planId, 'INVALID_PLAN_ID', 'planId');
  const amount = parseUnsignedDecimal(input.amountAtomic, 'INVALID_AMOUNT', 'amountAtomic');
  if (amount === 0n) return fail('INVALID_AMOUNT', 'amountAtomic must be greater than zero.');

  const periodHours = parseUnsignedDecimal(input.periodHours, 'INVALID_PERIOD', 'periodHours');
  if (periodHours < SUBSCRIPTION_MIN_PERIOD_HOURS || periodHours > SUBSCRIPTION_MAX_PERIOD_HOURS) {
    return fail('INVALID_PERIOD', 'periodHours must be between 1 and 8760 whole hours.');
  }

  const endTs = parseUnsignedDecimal(input.endTs, 'INVALID_END_TS', 'endTs', I64_MAX);
  const chainTime = parseUnsignedDecimal(input.chainTimeUnixSeconds, 'INVALID_CHAIN_TIME', 'chainTimeUnixSeconds', I64_MAX);
  if (endTs !== 0n) {
    const minimumEndTs = chainTime + periodHours * 3_600n;
    if (minimumEndTs > I64_MAX || endTs < minimumEndTs) {
      return fail('INVALID_END_TS', 'A finite Plan end must be at least one complete billing period after the latest cluster time.');
    }
  }

  const ownerAddress = canonicalAddress(input.ownerAddress, 'ownerAddress');
  const destinationOwners = validateAddressList(input.destinationOwners, 'destinationOwners', SUBSCRIPTION_MAX_DESTINATIONS);
  const authorizedPullers = validateAddressList(input.authorizedPullers, 'authorizedPullers', SUBSCRIPTION_MAX_PULLERS);

  if (typeof input.metadataUri !== 'string' || textEncoder.encode(input.metadataUri).length > SUBSCRIPTION_METADATA_URI_MAX_BYTES) {
    return fail('INVALID_METADATA_URI', `metadataUri must be a string of at most ${SUBSCRIPTION_METADATA_URI_MAX_BYTES} UTF-8 bytes.`);
  }

  const asset = input.asset;
  if (
    !asset
    || (asset.asset !== 'USDC' && asset.asset !== 'USDT')
    || !asset.tokenMint
    || asset.tokenProgram !== 'spl-token'
    || !Number.isInteger(asset.decimals)
    || asset.decimals === null
    || asset.decimals < 0
    || asset.decimals > 255
  ) {
    return fail('INVALID_ASSET', 'Subscription v1 supports only server-configured USDC/USDT on the original SPL Token Program.');
  }

  const mint = canonicalAddress(asset.tokenMint, 'asset.tokenMint');

  return {
    planId: planId.toString(),
    amountAtomic: amount.toString(),
    periodHours: periodHours.toString(),
    endTs: endTs.toString(),
    ownerAddress,
    destinationOwners,
    authorizedPullers,
    metadataUri: input.metadataUri,
    asset: {
      asset: asset.asset,
      tokenMint: mint,
      tokenProgram: 'spl-token',
      decimals: asset.decimals,
    },
  };
}
