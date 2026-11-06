import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, verify as verifyEd25519 } from 'node:crypto';
import {
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import type {
  EffectiveAccountMeta,
  ProgramDeploymentAttestation,
  ResolvedCompiledInstruction,
  SubscriptionInnerInstruction,
  SubscriptionTokenBalance,
  SubscriptionTransactionEvidence,
} from './subscription-transaction-verifier.js';

interface RpcProvenance {
  /** Set by the trusted server adapter from the actual RPC request. */
  readonly requestedCommitment: 'processed' | 'confirmed' | 'finalized';
  /** Genesis hash obtained independently from this configured RPC endpoint. */
  readonly clusterGenesisHash: string;
  /** Non-secret allowlisted provider alias, never an endpoint URL. */
  readonly providerId: string;
  /** JSON-RPC request id; response correlation is mandatory. */
  readonly requestId: string | number;
  /** Derived from finalized Program + ProgramData account evidence. */
  readonly programDeployment: ProgramDeploymentAttestation | null;
}

export type SubscriptionRpcNormalization =
  | {
      readonly outcome: 'normalized';
      readonly evidence: SubscriptionTransactionEvidence;
    }
  | {
      readonly outcome: 'unknown';
      readonly reasons: readonly string[];
    };

interface MessageHeaderLike {
  readonly numRequiredSignatures: number;
  readonly numReadonlySignedAccounts: number;
  readonly numReadonlyUnsignedAccounts: number;
}

interface CompiledInstructionLike {
  readonly programIdIndex: number;
  readonly accountKeyIndexes: readonly number[];
  readonly data: Uint8Array;
}

interface LookupLike {
  readonly writableIndexes: readonly number[];
  readonly readonlyIndexes: readonly number[];
}

interface MessageLike {
  readonly header: MessageHeaderLike;
  readonly staticAccountKeys: readonly PublicKey[];
  readonly compiledInstructions: readonly CompiledInstructionLike[];
  readonly addressTableLookups?: readonly LookupLike[];
  serialize?(): Uint8Array;
}

function unknown(reason: string): SubscriptionRpcNormalization {
  return { outcome: 'unknown', reasons: [reason] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function canonicalAddress(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    const canonical = new PublicKey(value).toBase58();
    return canonical === value ? canonical : null;
  } catch {
    return null;
  }
}

function base58Decode(value: string): Uint8Array {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  if (value.length === 0) return new Uint8Array();
  let number = 0n;
  for (const char of value) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error('RPC_COMPILED_INSTRUCTION_DATA_BASE58_INVALID');
    number = number * 58n + BigInt(digit);
  }
  const bytes: number[] = [];
  while (number > 0n) {
    bytes.push(Number(number & 0xffn));
    number >>= 8n;
  }
  bytes.reverse();
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === '1') leadingZeroes += 1;
  return Uint8Array.from([...new Array<number>(leadingZeroes).fill(0), ...bytes]);
}

function base58Encode(value: Uint8Array): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  if (value.length === 0) return '';
  let number = 0n;
  for (const byte of value) number = (number << 8n) + BigInt(byte);
  let encoded = '';
  while (number > 0n) {
    const remainder = Number(number % 58n);
    encoded = alphabet[remainder] + encoded;
    number /= 58n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === 0) leadingZeroes += 1;
  return '1'.repeat(leadingZeroes) + encoded;
}

function readShortVector(bytes: Uint8Array, offset: number): { value: number; nextOffset: number } {
  let value = 0;
  let shift = 0;
  let cursor = offset;
  for (let i = 0; i < 3; i += 1) {
    if (cursor >= bytes.length) throw new Error('RPC_TRANSACTION_SIGNATURE_VECTOR_TRUNCATED');
    const byte = bytes[cursor++];
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, nextOffset: cursor };
    shift += 7;
  }
  throw new Error('RPC_TRANSACTION_SIGNATURE_VECTOR_INVALID');
}


const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function verifyEd25519MessageSignatures(
  signerPublicKeys: readonly PublicKey[],
  signatures: readonly Uint8Array[],
  messageBytes: Uint8Array,
): boolean {
  if (
    signerPublicKeys.length === 0 ||
    signerPublicKeys.length !== signatures.length
  ) return false;

  try {
    return signatures.every((signature, index) => {
      if (
        !(signature instanceof Uint8Array) ||
        signature.length !== 64 ||
        signature.every(byte => byte === 0)
      ) return false;

      const derKey = Buffer.concat([
        ED25519_SPKI_PREFIX,
        Buffer.from(signerPublicKeys[index].toBytes()),
      ]);
      const publicKey = createPublicKey({ key: derKey, format: 'der', type: 'spki' });
      return verifyEd25519(null, Buffer.from(messageBytes), publicKey, Buffer.from(signature));
    });
  } catch {
    return false;
  }
}


interface DecodedWireTransaction {
  readonly message: MessageLike;
  readonly signature: string;
  readonly transactionVersion: 'legacy' | 0 | 1;
  readonly signatureCount: number;
  /** Exact message bytes that are covered by every transaction signature. */
  readonly messageBytes: Uint8Array;
}

function deserializeV1WireTransaction(wire: Uint8Array): DecodedWireTransaction {
  if (wire[0] !== 0x81 || wire.length < 1 + 3 + 64) {
    throw new Error('RPC_V1_TRANSACTION_WIRE_INVALID');
  }
  // Version 1 has no shortvec signature-count prefix: the count is the second
  // byte of the v1 message header. Signatures follow the serialized message.
  const signatureCount = wire[1];
  if (!isIntegerInRange(signatureCount, 1, 64)) {
    throw new Error('RPC_V1_SIGNATURE_COUNT_INVALID');
  }
  const messageLength = wire.length - signatureCount * 64;
  if (messageLength < 1 + 3 + 4 + 32 || messageLength >= wire.length) {
    throw new Error('RPC_V1_MESSAGE_LENGTH_INVALID');
  }

  const messageBytes = new Uint8Array(wire.subarray(0, messageLength));
  const transaction = VersionedTransaction.deserialize(Buffer.from(wire));
  const message = transaction.message;
  if (
    message.version !== 1 ||
    message.header.numRequiredSignatures !== signatureCount ||
    transaction.signatures.length !== signatureCount ||
    transaction.signatures.some(signature =>
      !(signature instanceof Uint8Array) ||
      signature.length !== 64 ||
      signature.every(byte => byte === 0)
    )
  ) throw new Error('RPC_V1_TRANSACTION_SIGNATURE_LAYOUT_INVALID');

  // web3.js 1.99.0 can deserialize MessageV1, but MessageV1.serialize()
  // intentionally throws. Hash/verify the exact original wire message bytes.
  if (!verifyEd25519MessageSignatures(
    message.staticAccountKeys.slice(0, signatureCount),
    transaction.signatures,
    messageBytes,
  )) throw new Error('RPC_TRANSACTION_SIGNATURE_VERIFICATION_FAILED');

  return {
    message: message as unknown as MessageLike,
    signature: base58Encode(transaction.signatures[0]),
    transactionVersion: 1,
    signatureCount,
    messageBytes,
  };
}

function deserializeWireTransaction(wire: Uint8Array): DecodedWireTransaction {
  if (wire.length === 0) throw new Error('RPC_TRANSACTION_WIRE_EMPTY');

  // Version 1 uses a different transaction wire layout: message first,
  // followed by signatures. Legacy and v0 use shortvec(signature count),
  // signatures, then message.
  if (wire[0] === 0x81) return deserializeV1WireTransaction(wire);

  const signatureVector = readShortVector(wire, 0);
  if (!isIntegerInRange(signatureVector.value, 1, 64)) {
    throw new Error('RPC_TRANSACTION_SIGNATURE_COUNT_INVALID');
  }
  const messageOffset = signatureVector.nextOffset + signatureVector.value * 64;
  if (messageOffset >= wire.length) throw new Error('RPC_TRANSACTION_MESSAGE_MISSING');

  const firstMessageByte = wire[messageOffset];
  const isVersionedMessage = (firstMessageByte & 0x80) !== 0;

  if (isVersionedMessage) {
    const version = firstMessageByte & 0x7f;
    if (version !== 0) throw new Error('RPC_TRANSACTION_VERSION_UNSUPPORTED');

    const transaction = VersionedTransaction.deserialize(Buffer.from(wire));
    if (
      transaction.message.version !== 0 ||
      transaction.signatures.length !== signatureVector.value ||
      transaction.signatures.some(signature =>
        !(signature instanceof Uint8Array) ||
        signature.length !== 64 ||
        signature.every(byte => byte === 0)
      )
    ) throw new Error('RPC_TRANSACTION_SIGNATURE_LAYOUT_INVALID');

    const messageBytes = transaction.message.serialize();
    const requiredSignatures = transaction.message.header.numRequiredSignatures;
    if (
      requiredSignatures !== signatureVector.value ||
      !verifyEd25519MessageSignatures(
        transaction.message.staticAccountKeys.slice(0, requiredSignatures),
        transaction.signatures,
        messageBytes,
      )
    ) throw new Error('RPC_TRANSACTION_SIGNATURE_VERIFICATION_FAILED');
    if (Buffer.compare(Buffer.from(messageBytes), Buffer.from(wire.subarray(messageOffset))) !== 0) {
      throw new Error('RPC_TRANSACTION_MESSAGE_WIRE_MISMATCH');
    }

    return {
      message: transaction.message as unknown as MessageLike,
      signature: base58Encode(transaction.signatures[0]),
      transactionVersion: 0,
      signatureCount: signatureVector.value,
      messageBytes: new Uint8Array(messageBytes),
    };
  }

  const transaction = Transaction.from(Buffer.from(wire));
  if (transaction.signatures.length !== signatureVector.value) {
    throw new Error('RPC_TRANSACTION_SIGNATURE_COUNT_MISMATCH');
  }
  const message = transaction.compileMessage();
  const messageBytes = message.serialize();
  const requiredSignatures = message.header.numRequiredSignatures;
  const signatureKeys = transaction.signatures.map(entry => entry.publicKey);
  const signatures = transaction.signatures.map(entry => {
    if (!entry.signature) throw new Error('RPC_TRANSACTION_SIGNATURE_MISSING');
    return new Uint8Array(entry.signature);
  });

  if (
    requiredSignatures !== signatureVector.value ||
    signatures.length !== requiredSignatures ||
    signatureKeys.some((key, index) => !key.equals(message.accountKeys[index])) ||
    !verifyEd25519MessageSignatures(
      message.accountKeys.slice(0, requiredSignatures),
      signatures,
      messageBytes,
    )
  ) throw new Error('RPC_TRANSACTION_SIGNATURE_VERIFICATION_FAILED');
  if (Buffer.compare(Buffer.from(messageBytes), Buffer.from(wire.subarray(messageOffset))) !== 0) {
    throw new Error('RPC_TRANSACTION_MESSAGE_WIRE_MISMATCH');
  }

  return {
    message: message as unknown as MessageLike,
    signature: base58Encode(signatures[0]),
    transactionVersion: 'legacy',
    signatureCount: signatureVector.value,
    messageBytes: new Uint8Array(messageBytes),
  };
}

function normalizeLoadedAddresses(
  meta: Record<string, unknown>,
  message: MessageLike,
): { writable: string[]; readonly: string[] } {
  const lookups = message.addressTableLookups ?? [];
  const expectedWritable = lookups.reduce((sum, lookup) => sum + lookup.writableIndexes.length, 0);
  const expectedReadonly = lookups.reduce((sum, lookup) => sum + lookup.readonlyIndexes.length, 0);
  const raw = meta.loadedAddresses;

  if (expectedWritable + expectedReadonly > 0 && !isRecord(raw)) {
    throw new Error('RPC_LOADED_ADDRESSES_MISSING');
  }
  if (raw === undefined || raw === null) return { writable: [], readonly: [] };
  if (!isRecord(raw) || !Array.isArray(raw.writable) || !Array.isArray(raw.readonly)) {
    throw new Error('RPC_LOADED_ADDRESSES_INVALID');
  }

  const writable = raw.writable.map(canonicalAddress);
  const readonly = raw.readonly.map(canonicalAddress);
  if (
    writable.some(address => address === null) ||
    readonly.some(address => address === null) ||
    writable.length !== expectedWritable ||
    readonly.length !== expectedReadonly
  ) throw new Error('RPC_LOADED_ADDRESSES_COUNT_OR_ADDRESS_INVALID');

  return {
    writable: writable as string[],
    readonly: readonly as string[],
  };
}

function effectiveAccountMeta(
  index: number,
  staticCount: number,
  totalCount: number,
  header: MessageHeaderLike,
  loadedWritableCount: number,
  address: string,
): EffectiveAccountMeta {
  const required = header.numRequiredSignatures;
  const readonlySigned = header.numReadonlySignedAccounts;
  const readonlyUnsigned = header.numReadonlyUnsignedAccounts;

  if (!isIntegerInRange(index, 0, totalCount - 1)) throw new Error('RPC_ACCOUNT_INDEX_OUT_OF_RANGE');

  let isSigner = false;
  let isWritable = false;
  if (index < staticCount) {
    isSigner = index < required;
    isWritable = isSigner
      ? index < required - readonlySigned
      : index < staticCount - readonlyUnsigned;
  } else {
    isWritable = index < staticCount + loadedWritableCount;
  }

  return { address: address as EffectiveAccountMeta['address'], isSigner, isWritable };
}

function normalizeBalances(value: unknown, accountCount: number): SubscriptionTokenBalance[] {
  if (!Array.isArray(value)) throw new Error('RPC_TOKEN_BALANCES_MISSING');
  return value.map((item: unknown) => {
    if (!isRecord(item) || !isRecord(item.uiTokenAmount)) {
      throw new Error('RPC_TOKEN_BALANCE_ENTRY_INVALID');
    }
    const accountIndex = item.accountIndex;
    const mint = canonicalAddress(item.mint);
    const owner = canonicalAddress(item.owner);
    const programAddress = canonicalAddress(item.programId);
    const amountAtomic = item.uiTokenAmount.amount;

    if (
      !isIntegerInRange(accountIndex, 0, accountCount - 1) ||
      !mint ||
      !owner ||
      !programAddress ||
      typeof amountAtomic !== 'string' ||
      !/^(0|[1-9][0-9]*)$/.test(amountAtomic)
    ) throw new Error('RPC_TOKEN_BALANCE_PROVENANCE_INVALID');

    return {
      accountIndex,
      mint: mint as SubscriptionTokenBalance['mint'],
      owner: owner as SubscriptionTokenBalance['owner'],
      programAddress: programAddress as SubscriptionTokenBalance['programAddress'],
      amountAtomic,
    };
  });
}

function normalizeTransaction(
  result: Record<string, unknown>,
  provenance: RpcProvenance,
  rpcResponseHash: string,
): SubscriptionTransactionEvidence {
  const meta = result.meta;
  if (!isRecord(meta)) throw new Error('RPC_TRANSACTION_META_MISSING');
  if (!Object.hasOwn(meta, 'err')) throw new Error('RPC_TRANSACTION_EXECUTION_STATUS_MISSING');

  const encoded = result.transaction;
  let base64: string;
  if (typeof encoded === 'string') {
    base64 = encoded;
  } else if (Array.isArray(encoded) && encoded.length === 2 && encoded[1] === 'base64' && typeof encoded[0] === 'string') {
    base64 = encoded[0];
  } else {
    throw new Error('RPC_TRANSACTION_ENCODING_NOT_BASE64');
  }
  if (
    base64.length === 0 ||
    base64.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)
  ) throw new Error('RPC_TRANSACTION_BASE64_INVALID');

  const wire = Buffer.from(base64, 'base64');
  if (wire.length === 0) throw new Error('RPC_TRANSACTION_WIRE_EMPTY');
  const decoded = deserializeWireTransaction(wire);

  if (
    result.version !== undefined &&
    result.version !== null &&
    result.version !== decoded.transactionVersion
  ) throw new Error('RPC_TRANSACTION_VERSION_FIELD_MISMATCH');

  const message = decoded.message;
  const staticKeys = message.staticAccountKeys;
  const header = message.header;
  if (!Array.isArray(staticKeys) || staticKeys.length === 0 || !header) {
    throw new Error('RPC_MESSAGE_STATIC_KEYS_OR_HEADER_MISSING');
  }
  const staticAddresses = staticKeys.map(key => key.toBase58());
  if (staticAddresses.some(address => !canonicalAddress(address))) {
    throw new Error('RPC_MESSAGE_STATIC_KEY_INVALID');
  }
  if (
    !isIntegerInRange(header.numRequiredSignatures, 1, staticKeys.length) ||
    !isIntegerInRange(header.numReadonlySignedAccounts, 0, header.numRequiredSignatures) ||
    !isIntegerInRange(header.numReadonlyUnsignedAccounts, 0, staticKeys.length - header.numRequiredSignatures)
  ) throw new Error('RPC_MESSAGE_HEADER_INVALID');
  if (decoded.signatureCount !== header.numRequiredSignatures) {
    throw new Error('RPC_TRANSACTION_SIGNATURE_HEADER_COUNT_MISMATCH');
  }

  const loaded = normalizeLoadedAddresses(meta, message);
  const accountKeys = [...staticAddresses, ...loaded.writable, ...loaded.readonly];
  if (accountKeys.length > 256) throw new Error('RPC_TRANSACTION_ACCOUNT_KEY_LIMIT_EXCEEDED');

  const instructions = message.compiledInstructions;
  if (!Array.isArray(instructions) || instructions.length === 0) {
    throw new Error('RPC_TOP_LEVEL_INSTRUCTIONS_MISSING');
  }
  const topLevelInstructions: ResolvedCompiledInstruction[] = instructions.map(instruction => {
    const programIdIndex = instruction.programIdIndex;
    const accountIndexes = instruction.accountKeyIndexes;
    if (
      !isIntegerInRange(programIdIndex, 0, accountKeys.length - 1) ||
      !Array.isArray(accountIndexes) ||
      accountIndexes.some(index => !isIntegerInRange(index, 0, accountKeys.length - 1)) ||
      !(instruction.data instanceof Uint8Array)
    ) throw new Error('RPC_COMPILED_INSTRUCTION_INVALID');

    const accountAddresses = accountIndexes.map(index => accountKeys[index]);
    const accounts = accountIndexes.map(index =>
      effectiveAccountMeta(
        index,
        staticAddresses.length,
        accountKeys.length,
        header,
        loaded.writable.length,
        accountKeys[index],
      ),
    );

    return {
      programAddress: accountKeys[programIdIndex] as ResolvedCompiledInstruction['programAddress'],
      programIdIndex,
      accountIndexes,
      data: new Uint8Array(instruction.data),
      accountAddresses: accountAddresses as ResolvedCompiledInstruction['accountAddresses'],
      accounts,
    };
  });

  const innerInstructions = new Map<number, readonly SubscriptionInnerInstruction[]>();
  const rawInner = meta.innerInstructions;
  if (Array.isArray(rawInner)) {
    for (const group of rawInner) {
      if (!isRecord(group) || !isIntegerInRange(group.index, 0, topLevelInstructions.length - 1) || !Array.isArray(group.instructions)) {
        throw new Error('RPC_INNER_INSTRUCTION_GROUP_INVALID');
      }
      if (innerInstructions.has(group.index)) throw new Error('RPC_INNER_INSTRUCTION_GROUP_DUPLICATED');
      const normalized = group.instructions.map((instruction: unknown): SubscriptionInnerInstruction => {
        if (!isRecord(instruction)) throw new Error('RPC_INNER_INSTRUCTION_INVALID');
        const programIdIndex = instruction.programIdIndex;
        const accountIndexes = instruction.accounts;
        const data = instruction.data;
        const stackHeight = instruction.stackHeight;
        if (
          !isIntegerInRange(programIdIndex, 0, accountKeys.length - 1) ||
          !Array.isArray(accountIndexes) ||
          accountIndexes.some(index => !isIntegerInRange(index, 0, accountKeys.length - 1)) ||
          typeof data !== 'string' ||
          !isIntegerInRange(stackHeight, 1, 255)
        ) throw new Error('RPC_INNER_INSTRUCTION_FIELDS_INVALID');

        const accountAddresses = accountIndexes.map(index => accountKeys[index]);
        return {
          programAddress: accountKeys[programIdIndex] as SubscriptionInnerInstruction['programAddress'],
          programIdIndex,
          accountIndexes,
          data: base58Decode(data),
          accountAddresses: accountAddresses as SubscriptionInnerInstruction['accountAddresses'],
          stackHeight,
        };
      });
      innerInstructions.set(group.index, normalized);
    }
  } else if (rawInner !== null && rawInner !== undefined) {
    throw new Error('RPC_INNER_INSTRUCTIONS_INVALID');
  }

  const slot = result.slot;
  if (!isIntegerInRange(slot, 0, Number.MAX_SAFE_INTEGER)) throw new Error('RPC_TRANSACTION_SLOT_INVALID');
  const blockTime = result.blockTime;
  const blockTimeUnixSeconds =
    blockTime === null ? null :
    isIntegerInRange(blockTime, 0, Number.MAX_SAFE_INTEGER) ? BigInt(blockTime) :
    null;

  const preTokenBalances = normalizeBalances(meta.preTokenBalances, accountKeys.length);
  const postTokenBalances = normalizeBalances(meta.postTokenBalances, accountKeys.length);
  const messageHash = createHash('sha256').update(Buffer.from(decoded.messageBytes)).digest('hex');

  if (
    typeof provenance.providerId !== 'string' ||
    !/^[a-z0-9][a-z0-9._:-]{0,79}$/i.test(provenance.providerId)
  ) throw new Error('RPC_PROVIDER_ALIAS_INVALID');
  if (!canonicalAddress(provenance.clusterGenesisHash)) {
    throw new Error('RPC_CLUSTER_GENESIS_HASH_INVALID');
  }

  return {
    signature: decoded.signature,
    transactionVersion: decoded.transactionVersion,
    messageHash,
    commitment: provenance.requestedCommitment,
    clusterGenesisHash: provenance.clusterGenesisHash,
    slot: BigInt(slot),
    blockTimeUnixSeconds,
    transactionError: meta.err,
    programDeployment: provenance.programDeployment,
    feePayer: accountKeys[0] as SubscriptionTransactionEvidence['feePayer'],
    feePayerIsSigner: effectiveAccountMeta(
      0,
      staticAddresses.length,
      accountKeys.length,
      header,
      loaded.writable.length,
      accountKeys[0],
    ).isSigner,
    feePayerIsWritable: effectiveAccountMeta(
      0,
      staticAddresses.length,
      accountKeys.length,
      header,
      loaded.writable.length,
      accountKeys[0],
    ).isWritable,
    rpcProviderId: provenance.providerId,
    rpcResponseHash,
    accountKeys: accountKeys as SubscriptionTransactionEvidence['accountKeys'],
    topLevelInstructions,
    innerInstructions,
    preTokenBalances,
    postTokenBalances,
  };
}

/**
 * Normalize a raw getTransaction JSON-RPC response requested with
 * encoding=base64. This module performs no RPC call, signing, submission,
 * persistence or accounting.
 *
 * The caller must set provenance from the actual configured RPC request and
 * separately verified endpoint genesis hash / ProgramData evidence. Missing
 * metadata or unsupported transaction versions fail closed as UNKNOWN.
 */
export function normalizeSubscriptionGetTransactionResponse(
  rawResponseBody: string,
  provenance: RpcProvenance,
): SubscriptionRpcNormalization {
  if (typeof rawResponseBody !== 'string' || rawResponseBody.length === 0) {
    return unknown('Raw getTransaction response body is missing.');
  }

  try {
    const payload: unknown = JSON.parse(rawResponseBody);
    if (
      !isRecord(payload) ||
      payload.jsonrpc !== '2.0' ||
      !Object.hasOwn(payload, 'id') ||
      payload.id !== provenance.requestId ||
      Object.hasOwn(payload, 'error') ||
      !Object.hasOwn(payload, 'result')
    ) return unknown('JSON-RPC version, request correlation, error or result envelope is invalid.');
    if (payload.result === null) return unknown('The configured RPC did not return the requested transaction.');
    if (!isRecord(payload.result)) return unknown('getTransaction result has an unsupported JSON shape.');

    const rpcResponseHash = createHash('sha256').update(rawResponseBody, 'utf8').digest('hex');
    const evidence = normalizeTransaction(payload.result, provenance, rpcResponseHash);
    return { outcome: 'normalized', evidence };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RPC_TRANSACTION_NORMALIZATION_FAILED';
    return unknown(message);
  }
}
