import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { PublicKey } from '@solana/web3.js';

export const SQUADS_V4_PROGRAM_ID = 'SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf';
export const SQUADS_V4_MULTISIG_STATE_ADDRESS = '4CxQs26DewQ1KaCHfyyjktkYjndNdUqCJvVdygtJFwcJ';
export const SQUADS_V4_VAULT_ADDRESS = 'DXtFpbPjcn2hxPnw79x1Pfoj35vXh5AsWBkS37YnXMVv';
export const SQUADS_V4_MAX_TIME_LOCK_SECONDS = 3 * 30 * 24 * 60 * 60;

const ANCHOR_MULTISIG_DISCRIMINATOR = createHash('sha256')
  .update('account:Multisig', 'utf8')
  .digest()
  .subarray(0, 8);

const PERMISSION_INITIATE = 1;
const PERMISSION_VOTE = 2;
const PERMISSION_EXECUTE = 4;

function readPubkey(data, offset, label) {
  if (offset < 0 || offset + 32 > data.length) throw new Error(`SQUADS_V4_${label}_TRUNCATED`);
  return new PublicKey(data.subarray(offset, offset + 32)).toBase58();
}

function isDefaultPubkey(value) {
  return value === '11111111111111111111111111111111';
}

export function deriveSquadsV4MultisigStateAddress(createKey) {
  const createKeyBytes = new PublicKey(createKey).toBuffer();
  const [address, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('multisig', 'utf8'), Buffer.from('multisig', 'utf8'), createKeyBytes],
    new PublicKey(SQUADS_V4_PROGRAM_ID),
  );
  return { address: address.toBase58(), bump };
}

export function deriveSquadsV4VaultAddress(stateAddress) {
  const state = new PublicKey(stateAddress);
  const [address, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('multisig', 'utf8'), state.toBuffer(), Buffer.from('vault', 'utf8'), Buffer.from([0])],
    new PublicKey(SQUADS_V4_PROGRAM_ID),
  );
  return { address: address.toBase58(), bump };
}

export function parseSquadsV4MultisigAccount(accountData) {
  if (!Buffer.isBuffer(accountData) || accountData.length < 101) {
    throw new Error('SQUADS_V4_MULTISIG_ACCOUNT_TRUNCATED');
  }
  if (!accountData.subarray(0, 8).equals(ANCHOR_MULTISIG_DISCRIMINATOR)) {
    throw new Error('SQUADS_V4_MULTISIG_DISCRIMINATOR_INVALID');
  }

  const createKey = readPubkey(accountData, 8, 'CREATE_KEY');
  const configAuthority = readPubkey(accountData, 40, 'CONFIG_AUTHORITY');
  const threshold = accountData.readUInt16LE(72);
  const timeLockSeconds = accountData.readUInt32LE(74);
  const transactionIndex = accountData.readBigUInt64LE(78);
  const staleTransactionIndex = accountData.readBigUInt64LE(86);

  let offset = 94;
  const rentCollectorOption = accountData[offset++];
  let rentCollector = null;
  if (rentCollectorOption === 1) {
    rentCollector = readPubkey(accountData, offset, 'RENT_COLLECTOR');
    offset += 32;
  } else if (rentCollectorOption !== 0) {
    throw new Error('SQUADS_V4_RENT_COLLECTOR_OPTION_INVALID');
  }

  const bump = accountData[offset++];
  if (offset + 4 > accountData.length) throw new Error('SQUADS_V4_MEMBERS_LENGTH_TRUNCATED');
  const memberCount = accountData.readUInt32LE(offset);
  offset += 4;

  if (memberCount === 0 || memberCount > 0xffff) {
    throw new Error('SQUADS_V4_MEMBERS_COUNT_INVALID');
  }
  if (offset + memberCount * 33 > accountData.length) {
    throw new Error('SQUADS_V4_MEMBERS_DATA_TRUNCATED');
  }

  const members = [];
  let previousMemberKey = null;
  let voterCount = 0;
  let proposerCount = 0;
  let executorCount = 0;

  for (let index = 0; index < memberCount; index += 1) {
    const keyBytes = accountData.subarray(offset, offset + 32);
    const key = new PublicKey(keyBytes).toBase58();
    const permissionMask = accountData[offset + 32];
    offset += 33;

    if (permissionMask >= 8) throw new Error('SQUADS_V4_MEMBER_PERMISSION_MASK_INVALID');
    if (previousMemberKey && Buffer.compare(previousMemberKey, keyBytes) >= 0) {
      throw new Error('SQUADS_V4_MEMBER_ORDER_OR_DUPLICATE_INVALID');
    }
    previousMemberKey = Buffer.from(keyBytes);

    const permissions = {
      initiate: (permissionMask & PERMISSION_INITIATE) !== 0,
      vote: (permissionMask & PERMISSION_VOTE) !== 0,
      execute: (permissionMask & PERMISSION_EXECUTE) !== 0,
      mask: permissionMask,
    };
    if (permissions.vote) voterCount += 1;
    if (permissions.initiate) proposerCount += 1;
    if (permissions.execute) executorCount += 1;
    members.push({ key, permissions });
  }

  if (threshold === 0 || threshold > voterCount) {
    throw new Error('SQUADS_V4_THRESHOLD_INVALID');
  }
  if (proposerCount === 0) throw new Error('SQUADS_V4_NO_PROPOSERS');
  if (executorCount === 0) throw new Error('SQUADS_V4_NO_EXECUTORS');
  if (staleTransactionIndex > transactionIndex) {
    throw new Error('SQUADS_V4_STALE_TRANSACTION_INDEX_INVALID');
  }
  if (timeLockSeconds > SQUADS_V4_MAX_TIME_LOCK_SECONDS) {
    throw new Error('SQUADS_V4_TIME_LOCK_INVALID');
  }

  return {
    createKey,
    configAuthority,
    configAuthorityIsDefault: isDefaultPubkey(configAuthority),
    threshold,
    timeLockSeconds,
    transactionIndex: transactionIndex.toString(),
    staleTransactionIndex: staleTransactionIndex.toString(),
    rentCollector,
    bump,
    memberCount,
    voterCount,
    proposerCount,
    executorCount,
    members,
    serializedStateBytes: offset,
    trailingAllocatedBytes: accountData.length - offset,
  };
}
