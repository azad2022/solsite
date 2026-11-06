import type { Address } from '@solana/kit';
import {
  decodeTransferSubscriptionInstruction,
  type CompiledSubscriptionInstruction,
} from './transfer-subscription-instruction.js';

const SUBSCRIPTIONS_PROGRAM =
  'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44' as Address;
const SPL_TOKEN_PROGRAM =
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
const COMPUTE_BUDGET_PROGRAM =
  'ComputeBudget111111111111111111111111111111' as Address;
const EVENT_TAG = new Uint8Array([228, 69, 165, 46, 81, 203, 154, 29]);
const EVENT_DISCRIMINATOR_SUBSCRIPTION_TRANSFER = 2;
const EVENT_LENGTH = 265;
const TOKEN_TRANSFER_CHECKED = 12;
const U64_MAX = (1n << 64n) - 1n;

export interface EffectiveAccountMeta {
  readonly address: Address;
  readonly isSigner: boolean;
  readonly isWritable: boolean;
}

export interface ResolvedCompiledInstruction extends CompiledSubscriptionInstruction {
  readonly accounts: readonly EffectiveAccountMeta[];
}

export interface SubscriptionInnerInstruction {
  readonly programAddress: Address;
  readonly data: Uint8Array;
  readonly accountAddresses: readonly Address[];
}

export interface SubscriptionTokenBalance {
  readonly accountIndex: number;
  readonly mint: Address;
  readonly owner: Address;
  readonly programAddress: Address;
  /** Raw integer amount from the RPC tokenAmount.amount string. */
  readonly amountAtomic: string;
}

export interface SubscriptionTransactionEvidence {
  readonly signature: string;
  readonly commitment: string;
  readonly clusterGenesisHash: string;
  readonly slot: bigint;
  readonly blockTimeUnixSeconds: bigint | null;
  readonly transactionError: unknown | null;
  readonly feePayer: Address;
  /** Account keys in the same resolved order used by compiled instruction indexes. */
  readonly accountKeys: readonly Address[];
  readonly topLevelInstructions: readonly ResolvedCompiledInstruction[];
  /** Inner instructions grouped by their originating top-level instruction index. */
  readonly innerInstructions: ReadonlyMap<number, readonly SubscriptionInnerInstruction[]>;
  readonly preTokenBalances: readonly SubscriptionTokenBalance[];
  readonly postTokenBalances: readonly SubscriptionTokenBalance[];
}

export interface ExpectedSubscriptionTransaction {
  readonly clusterGenesisHash: string;
  readonly merchant: Address;
  readonly merchantFeePayer: Address;
  readonly subscriber: Address;
  readonly planPda: Address;
  readonly subscriptionPda: Address;
  readonly authorityPda: Address;
  readonly sourceAta: Address;
  readonly mint: Address;
  readonly mintDecimals: number;
  readonly planOwner: Address;
  readonly authorizedPullers: readonly Address[];
  readonly allowedDestinationOwners: readonly Address[];
  readonly expectedDestinationOwner: Address;
  readonly expectedDestinationAta: Address;
  readonly expectedAmountAtomic: bigint;
  readonly expectedPeriodStartTs: bigint;
  readonly expectedPeriodEndTs: bigint;
  readonly expectedCumulativeAmountAtomic: bigint;
}

export type SubscriptionTransactionFailureCode =
  | 'transaction_not_finalized'
  | 'cluster_genesis_mismatch'
  | 'invalid_chain_context'
  | 'transaction_execution_failed'
  | 'missing_signature'
  | 'fee_payer_mismatch'
  | 'unexpected_top_level_instruction'
  | 'subscription_instruction_invalid'
  | 'instruction_privilege_invalid'
  | 'puller_not_authorized'
  | 'destination_owner_not_allowed'
  | 'event_missing_or_invalid'
  | 'token_cpi_missing_or_invalid'
  | 'token_balance_evidence_missing'
  | 'token_balance_delta_mismatch'
  | 'attempt_amount_mismatch'
  | 'period_correlation_mismatch';

export type SubscriptionTransactionVerification =
  | {
      readonly outcome: 'verified_observation';
      readonly evidence: 'finalized-subscription-transfer-transaction';
      readonly signature: string;
      readonly slot: bigint;
      readonly blockTimeUnixSeconds: bigint;
      readonly puller: Address;
      readonly feePayer: Address;
      readonly destinationOwner: Address;
      readonly destinationAta: Address;
      readonly amountAtomic: bigint;
      readonly periodStartTs: bigint;
      readonly periodEndTs: bigint;
      readonly cumulativeAmountAtomic: bigint;
    }
  | {
      readonly outcome: 'rejected';
      readonly failures: readonly SubscriptionTransactionFailureCode[];
    }
  | {
      readonly outcome: 'unknown';
      readonly reasons: readonly string[];
    };

interface DecodedTransferEvent {
  readonly subscription: Address;
  readonly plan: Address;
  readonly delegator: Address;
  readonly mint: Address;
  readonly amountAtomic: bigint;
  readonly periodStartTs: bigint;
  readonly periodEndTs: bigint;
  readonly cumulativeAmountAtomic: bigint;
  readonly receiver: Address;
  readonly receiverAta: Address;
  readonly puller: Address;
}

function readU64LE(bytes: Uint8Array, offset: number): bigint {
  if (offset < 0 || offset + 8 > bytes.length) throw new RangeError('u64 out of bounds');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigUint64(offset, true);
}

function readI64LE(bytes: Uint8Array, offset: number): bigint {
  if (offset < 0 || offset + 8 > bytes.length) throw new RangeError('i64 out of bounds');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigInt64(offset, true);
}

function readAddress(bytes: Uint8Array, offset: number): Address {
  if (offset < 0 || offset + 32 > bytes.length) throw new RangeError('address out of bounds');
  // Base58 encoding is delegated to the already-pinned web3.js PublicKey dependency
  // through the structural decoder's canonical address validation path.
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = 0n;
  for (const byte of bytes.slice(offset, offset + 32)) value = (value << 8n) + BigInt(byte);
  let encoded = '';
  while (value > 0n) {
    const remainder = Number(value % 58n);
    encoded = alphabet[remainder] + encoded;
    value /= 58n;
  }
  for (let i = offset; i < offset + 32 && bytes[i] === 0; i += 1) encoded = '1' + encoded;
  return encoded as Address;
}

function decodeTransferEvent(data: Uint8Array): DecodedTransferEvent {
  if (!(data instanceof Uint8Array) || data.length !== EVENT_LENGTH) {
    throw new RangeError('SubscriptionTransfer event must be exactly 265 bytes.');
  }
  for (let i = 0; i < EVENT_TAG.length; i += 1) {
    if (data[i] !== EVENT_TAG[i]) throw new Error('Subscription event tag mismatch.');
  }
  if (data[8] !== EVENT_DISCRIMINATOR_SUBSCRIPTION_TRANSFER) {
    throw new Error('Expected SubscriptionTransfer event discriminator 2.');
  }
  return {
    subscription: readAddress(data, 9),
    plan: readAddress(data, 41),
    delegator: readAddress(data, 73),
    mint: readAddress(data, 105),
    amountAtomic: readU64LE(data, 137),
    periodStartTs: readI64LE(data, 145),
    periodEndTs: readI64LE(data, 153),
    cumulativeAmountAtomic: readU64LE(data, 161),
    receiver: readAddress(data, 169),
    receiverAta: readAddress(data, 201),
    puller: readAddress(data, 233),
  };
}

function findBalance(
  balances: readonly SubscriptionTokenBalance[],
  accountIndex: number,
  mint: Address,
  owner: Address,
): bigint | null {
  const matches = balances.filter(balance =>
    balance.accountIndex === accountIndex &&
    balance.mint === mint &&
    balance.owner === owner &&
    balance.programAddress === SPL_TOKEN_PROGRAM,
  );
  if (matches.length !== 1) return null;
  const raw = matches[0].amountAtomic;
  if (typeof raw !== 'string' || !/^(0|[1-9][0-9]*)$/.test(raw)) return null;
  const amount = BigInt(raw);
  return amount <= U64_MAX ? amount : null;
}

function reject(failures: SubscriptionTransactionFailureCode[]): SubscriptionTransactionVerification {
  return { outcome: 'rejected', failures: [...new Set(failures)] };
}

/**
 * Pure verification policy for the pinned v0.5.0 TransferSubscription wire path.
 *
 * The caller must normalize the RPC response without dropping message privileges,
 * loaded addresses, CPI instruction order or pre/post token balance provenance.
 * This function performs no RPC, signing, submission, persistence or accounting.
 * It deliberately does not return a paid/entitled state.
 */
export function verifySubscriptionTransferTransaction(
  expected: ExpectedSubscriptionTransaction,
  evidence: SubscriptionTransactionEvidence,
): SubscriptionTransactionVerification {
  const failures: SubscriptionTransactionFailureCode[] = [];
  const unknown: string[] = [];

  if (evidence.commitment !== 'finalized') failures.push('transaction_not_finalized');
  if (
    !expected.clusterGenesisHash ||
    evidence.clusterGenesisHash !== expected.clusterGenesisHash
  ) failures.push('cluster_genesis_mismatch');
  if (
    typeof evidence.slot !== 'bigint' ||
    evidence.slot < 0n ||
    evidence.slot > U64_MAX ||
    typeof evidence.blockTimeUnixSeconds !== 'bigint' ||
    evidence.blockTimeUnixSeconds < 0n
  ) failures.push('invalid_chain_context');
  if (evidence.transactionError !== null) failures.push('transaction_execution_failed');
  if (typeof evidence.signature !== 'string' || evidence.signature.length < 80) {
    failures.push('missing_signature');
  }
  if (evidence.feePayer !== expected.merchantFeePayer) failures.push('fee_payer_mismatch');

  if (failures.length > 0) return reject(failures);

  if (
    !Array.isArray(evidence.accountKeys) ||
    !Array.isArray(evidence.topLevelInstructions) ||
    !(evidence.innerInstructions instanceof Map)
  ) {
    return { outcome: 'unknown', reasons: ['RPC transaction evidence is incomplete or not normalized.'] };
  }

  const subscriptionInstructions = evidence.topLevelInstructions.filter(
    instruction => instruction.programAddress === SUBSCRIPTIONS_PROGRAM,
  );
  const unexpectedTopLevel = evidence.topLevelInstructions.filter(
    instruction =>
      instruction.programAddress !== SUBSCRIPTIONS_PROGRAM &&
      instruction.programAddress !== COMPUTE_BUDGET_PROGRAM,
  );
  if (subscriptionInstructions.length !== 1 || unexpectedTopLevel.length !== 0) {
    failures.push('unexpected_top_level_instruction');
  }
  if (failures.length > 0) return reject(failures);

  const instruction = subscriptionInstructions[0];
  let decoded;
  try {
    decoded = decodeTransferSubscriptionInstruction({
      programAddress: instruction.programAddress,
      data: instruction.data,
      accountAddresses: instruction.accountAddresses,
    });
  } catch {
    failures.push('subscription_instruction_invalid');
    return reject(failures);
  }

  const accounts = instruction.accounts;
  if (
    !Array.isArray(accounts) ||
    accounts.length !== 10 ||
    accounts.some((account, index) => account.address !== instruction.accountAddresses[index])
  ) {
    return { outcome: 'unknown', reasons: ['Resolved signer/writable privilege metadata is incomplete.'] };
  }

  const writableIndexes = [0, 3, 4];
  if (
    writableIndexes.some(index => accounts[index].isWritable !== true) ||
    accounts[5].isSigner !== true ||
    accounts.slice(0, 10).some((account, index) =>
      index !== 5 && account.isSigner === true
    )
  ) failures.push('instruction_privilege_invalid');

  const puller = decoded.accounts.caller;
  if (
    puller !== expected.planOwner &&
    !expected.authorizedPullers.includes(puller)
  ) failures.push('puller_not_authorized');

  if (
    decoded.accounts.subscriptionPda !== expected.subscriptionPda ||
    decoded.accounts.planPda !== expected.planPda ||
    decoded.accounts.subscriptionAuthorityPda !== expected.authorityPda ||
    decoded.accounts.delegatorAta !== expected.sourceAta ||
    decoded.accounts.tokenMint !== expected.mint ||
    decoded.delegator !== expected.subscriber ||
    decoded.mint !== expected.mint
  ) failures.push('subscription_instruction_invalid');

  if (decoded.amountAtomic !== expected.expectedAmountAtomic) {
    failures.push('attempt_amount_mismatch');
  }

  if (failures.length > 0) return reject(failures);

  const outerIndex = evidence.topLevelInstructions.indexOf(instruction);
  const inner = evidence.innerInstructions.get(outerIndex);
  if (!inner || inner.length !== 2) {
    unknown.push('Expected exactly one TransferChecked CPI and one Program event self-CPI; inner instruction evidence is missing or incomplete.');
    return { outcome: 'unknown', reasons: unknown };
  }

  const tokenCpis = inner.filter(item => item.programAddress === SPL_TOKEN_PROGRAM);
  const eventCpis = inner.filter(item => item.programAddress === SUBSCRIPTIONS_PROGRAM);
  if (tokenCpis.length !== 1 || eventCpis.length !== 1) {
    failures.push('token_cpi_missing_or_invalid');
    return reject(failures);
  }

  const tokenCpi = tokenCpis[0];
  const transferData = tokenCpi.data;
  if (
    transferData.length !== 10 ||
    transferData[0] !== TOKEN_TRANSFER_CHECKED ||
    tokenCpi.accountAddresses.length !== 4 ||
    tokenCpi.accountAddresses[0] !== expected.sourceAta ||
    tokenCpi.accountAddresses[1] !== expected.mint ||
    tokenCpi.accountAddresses[2] !== expected.expectedDestinationAta ||
    tokenCpi.accountAddresses[3] !== expected.authorityPda ||
    readU64LE(transferData, 1) !== expected.expectedAmountAtomic ||
    transferData[9] !== expected.mintDecimals
  ) failures.push('token_cpi_missing_or_invalid');

  let event: DecodedTransferEvent;
  try {
    event = decodeTransferEvent(eventCpis[0].data);
  } catch {
    failures.push('event_missing_or_invalid');
    return reject(failures);
  }

  if (
    event.subscription !== expected.subscriptionPda ||
    event.plan !== expected.planPda ||
    event.delegator !== expected.subscriber ||
    event.mint !== expected.mint ||
    event.amountAtomic !== expected.expectedAmountAtomic ||
    event.receiver !== expected.expectedDestinationOwner ||
    event.receiverAta !== expected.expectedDestinationAta ||
    event.puller !== puller
  ) failures.push('event_missing_or_invalid');

  if (!expected.allowedDestinationOwners.includes(event.receiver)) {
    failures.push('destination_owner_not_allowed');
  }
  if (
    event.periodStartTs !== expected.expectedPeriodStartTs ||
    event.periodEndTs !== expected.expectedPeriodEndTs ||
    event.cumulativeAmountAtomic !== expected.expectedCumulativeAmountAtomic
  ) failures.push('period_correlation_mismatch');

  if (failures.length > 0) return reject(failures);

  const sourceIndex = evidence.accountKeys.indexOf(expected.sourceAta);
  const destinationIndex = evidence.accountKeys.indexOf(expected.expectedDestinationAta);
  if (sourceIndex < 0 || destinationIndex < 0) {
    return { outcome: 'unknown', reasons: ['Source/destination account indexes are absent from the resolved transaction account-key list.'] };
  }

  const preSource = findBalance(evidence.preTokenBalances, sourceIndex, expected.mint, expected.subscriber);
  const postSource = findBalance(evidence.postTokenBalances, sourceIndex, expected.mint, expected.subscriber);
  const preDestination = findBalance(evidence.preTokenBalances, destinationIndex, expected.mint, expected.expectedDestinationOwner);
  const postDestination = findBalance(evidence.postTokenBalances, destinationIndex, expected.mint, expected.expectedDestinationOwner);

  if (
    preSource === null || postSource === null ||
    preDestination === null || postDestination === null
  ) {
    return { outcome: 'unknown', reasons: ['Pre/post token balance evidence for both source and destination is incomplete or ambiguous.'] };
  }

  if (
    preSource - postSource !== expected.expectedAmountAtomic ||
    postDestination - preDestination !== expected.expectedAmountAtomic
  ) failures.push('token_balance_delta_mismatch');

  if (failures.length > 0) return reject(failures);

  return {
    outcome: 'verified_observation',
    evidence: 'finalized-subscription-transfer-transaction',
    signature: evidence.signature,
    slot: evidence.slot,
    blockTimeUnixSeconds: evidence.blockTimeUnixSeconds as bigint,
    puller,
    feePayer: evidence.feePayer,
    destinationOwner: event.receiver,
    destinationAta: event.receiverAta,
    amountAtomic: event.amountAtomic,
    periodStartTs: event.periodStartTs,
    periodEndTs: event.periodEndTs,
    cumulativeAmountAtomic: event.cumulativeAmountAtomic,
  };
}
