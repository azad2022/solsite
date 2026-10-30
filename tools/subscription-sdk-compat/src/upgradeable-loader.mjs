import { Buffer } from 'node:buffer';
import { PublicKey } from '@solana/web3.js';

export const UPGRADEABLE_LOADER_PROGRAM_ID = 'BPFLoaderUpgradeab1e11111111111111111111111';
export const SOLANA_MAINNET_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';

const PROGRAM_STATE_TAG = 2;
const PROGRAM_DATA_STATE_TAG = 3;
const PROGRAM_STATE_BYTES = 36;
const PROGRAM_DATA_HEADER_BYTES = 13;
const PROGRAM_DATA_HEADER_WITH_AUTHORITY_BYTES = 45;

export function decodeBase64AccountData(rpcData, label) {
  if (!Array.isArray(rpcData) || typeof rpcData[0] !== 'string' || rpcData[1] !== 'base64') {
    throw new Error(`${label}_DATA_ENCODING_INVALID`);
  }
  const bytes = Buffer.from(rpcData[0], 'base64');
  if (bytes.length === 0) throw new Error(`${label}_DATA_EMPTY`);
  return bytes;
}

export function readProgramDataAddress(programAccountData) {
  if (!Buffer.isBuffer(programAccountData) || programAccountData.length !== PROGRAM_STATE_BYTES) {
    throw new Error('PROGRAM_STATE_LENGTH_INVALID');
  }
  if (programAccountData.readUInt32LE(0) !== PROGRAM_STATE_TAG) {
    throw new Error('PROGRAM_STATE_TAG_INVALID');
  }
  return new PublicKey(programAccountData.subarray(4, 36)).toBase58();
}

export function parseProgramDataAccount(programDataBytes) {
  if (!Buffer.isBuffer(programDataBytes) || programDataBytes.length < PROGRAM_DATA_HEADER_BYTES + 1) {
    throw new Error('PROGRAM_DATA_LENGTH_INVALID');
  }
  if (programDataBytes.readUInt32LE(0) !== PROGRAM_DATA_STATE_TAG) {
    throw new Error('PROGRAM_DATA_STATE_TAG_INVALID');
  }

  const deploymentSlot = programDataBytes.readBigUInt64LE(4);
  const authorityOption = programDataBytes[12];
  let upgradeAuthority = null;
  let elfOffset = PROGRAM_DATA_HEADER_BYTES;

  if (authorityOption === 1) {
    if (programDataBytes.length < PROGRAM_DATA_HEADER_WITH_AUTHORITY_BYTES + 1) {
      throw new Error('PROGRAM_DATA_AUTHORITY_TRUNCATED');
    }
    upgradeAuthority = new PublicKey(programDataBytes.subarray(13, 45)).toBase58();
    elfOffset = PROGRAM_DATA_HEADER_WITH_AUTHORITY_BYTES;
  } else if (authorityOption !== 0) {
    throw new Error('PROGRAM_DATA_AUTHORITY_OPTION_INVALID');
  }

  const elfBytes = programDataBytes.subarray(elfOffset);
  if (elfBytes.length === 0) throw new Error('PROGRAM_DATA_ELF_EMPTY');

  return {
    deploymentSlot: deploymentSlot.toString(),
    upgradeAuthority,
    elfOffset,
    elfBytes,
  };
}

export function deriveProgramDataAddress(programId) {
  const program = new PublicKey(programId);
  const loader = new PublicKey(UPGRADEABLE_LOADER_PROGRAM_ID);
  return PublicKey.findProgramAddressSync([program.toBuffer()], loader)[0].toBase58();
}

export function assertApprovedMainnetRpcUrl(rpcUrl) {
  if (typeof rpcUrl !== 'string' || rpcUrl.trim().length === 0) {
    throw new Error('MAINNET_RPC_URL_MISSING');
  }
  let endpoint;
  try {
    endpoint = new URL(rpcUrl);
  } catch {
    throw new Error('MAINNET_RPC_URL_FORMAT_INVALID');
  }
  if (endpoint.protocol !== 'https:') throw new Error('MAINNET_RPC_HTTPS_REQUIRED');
  const hostname = endpoint.hostname.toLowerCase();
  if (hostname !== 'mainnet.helius-rpc.com' && !hostname.endsWith('.helius-rpc.com')) {
    throw new Error('MAINNET_HELIUS_RPC_REQUIRED');
  }
  return true;
}

export function stripTrailingZeroBytes(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new Error('PROGRAM_BYTES_BUFFER_REQUIRED');
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end -= 1;
  if (end === 0) throw new Error('PROGRAM_BYTES_EMPTY_AFTER_ZERO_PADDING');
  return bytes.subarray(0, end);
}
