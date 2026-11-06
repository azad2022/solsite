import type { Address } from '@solana/kit';
import { PublicKey } from '@solana/web3.js';
import { SUBSCRIPTIONS_PROGRAM_ADDRESS } from '@solana/subscriptions';

export const TRANSFER_SUBSCRIPTION_DISCRIMINATOR = 10;
export const TRANSFER_SUBSCRIPTION_DATA_LENGTH = 73;
export const TRANSFER_SUBSCRIPTION_ACCOUNT_COUNT = 10;
export const ORIGINAL_SPL_TOKEN_PROGRAM_ADDRESS =
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;

export interface CompiledSubscriptionInstruction {
  readonly programAddress: Address;
  readonly data: Uint8Array;
  /** Resolved account addresses in compiled instruction index order. */
  readonly accountAddresses: readonly Address[];
}

export interface DecodedTransferSubscriptionInstruction {
  readonly programAddress: typeof SUBSCRIPTIONS_PROGRAM_ADDRESS;
  readonly discriminator: typeof TRANSFER_SUBSCRIPTION_DISCRIMINATOR;
  readonly amountAtomic: bigint;
  readonly delegator: Address;
  readonly mint: Address;
  readonly accounts: {
    readonly subscriptionPda: Address;
    readonly planPda: Address;
    readonly subscriptionAuthorityPda: Address;
    readonly delegatorAta: Address;
    readonly receiverAta: Address;
    readonly caller: Address;
    readonly tokenMint: Address;
    readonly tokenProgram: Address;
    readonly eventAuthority: Address;
    readonly selfProgram: Address;
  };
}

/**
 * Decode the pinned v0.5.0 TransferSubscription instruction only.
 *
 * This is a structural decoder, not transaction/payment verification. It
 * accepts already-resolved account addresses from a trusted transaction
 * parser; it does not fetch RPC data, validate signer/writable privileges,
 * inspect CPI effects, verify token movement, establish finality, or account.
 */
export function decodeTransferSubscriptionInstruction(
  instruction: CompiledSubscriptionInstruction,
): DecodedTransferSubscriptionInstruction {
  if (!instruction || typeof instruction !== 'object') {
    throw new TypeError('instruction must be an object.');
  }
  if (instruction.programAddress !== SUBSCRIPTIONS_PROGRAM_ADDRESS) {
    throw new Error('Unexpected Subscription Program ID.');
  }
  if (!(instruction.data instanceof Uint8Array)) {
    throw new TypeError('instruction.data must be Uint8Array.');
  }
  if (instruction.data.length !== TRANSFER_SUBSCRIPTION_DATA_LENGTH) {
    throw new RangeError('TransferSubscription data must be exactly 73 bytes.');
  }
  if (instruction.data[0] !== TRANSFER_SUBSCRIPTION_DISCRIMINATOR) {
    throw new Error('Unexpected Subscription instruction discriminator.');
  }
  if (!Array.isArray(instruction.accountAddresses)) {
    throw new TypeError('instruction.accountAddresses must be an array.');
  }
  if (instruction.accountAddresses.length !== TRANSFER_SUBSCRIPTION_ACCOUNT_COUNT) {
    throw new RangeError('TransferSubscription must contain exactly ten fixed accounts and no remaining accounts.');
  }

  const accounts = instruction.accountAddresses;
  if (accounts.some(value => typeof value !== 'string' || value.length === 0)) {
    throw new TypeError('Every resolved instruction account must be a non-empty address.');
  }
  if (accounts[7] !== ORIGINAL_SPL_TOKEN_PROGRAM_ADDRESS) {
    throw new Error('Subscription v1 requires the original SPL Token Program.');
  }
  if (accounts[9] !== SUBSCRIPTIONS_PROGRAM_ADDRESS) {
    throw new Error('TransferSubscription selfProgram account mismatch.');
  }

  const view = new DataView(
    instruction.data.buffer,
    instruction.data.byteOffset,
    instruction.data.byteLength,
  );
  const amountAtomic = view.getBigUint64(1, true);
  if (amountAtomic === 0n) {
    throw new RangeError('TransferSubscription amount must be greater than zero.');
  }

  const delegator = new PublicKey(instruction.data.slice(9, 41)).toBase58() as Address;
  const mint = new PublicKey(instruction.data.slice(41, 73)).toBase58() as Address;

  if (mint !== accounts[6]) {
    throw new Error('TransferSubscription mint argument does not match the tokenMint account.');
  }

  return {
    programAddress: SUBSCRIPTIONS_PROGRAM_ADDRESS,
    discriminator: TRANSFER_SUBSCRIPTION_DISCRIMINATOR,
    amountAtomic,
    delegator,
    mint,
    accounts: {
      subscriptionPda: accounts[0],
      planPda: accounts[1],
      subscriptionAuthorityPda: accounts[2],
      delegatorAta: accounts[3],
      receiverAta: accounts[4],
      caller: accounts[5],
      tokenMint: accounts[6],
      tokenProgram: accounts[7],
      eventAuthority: accounts[8],
      selfProgram: accounts[9],
    },
  };
}
