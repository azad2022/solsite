import { Buffer } from 'node:buffer';
import { PublicKey } from '@solana/web3.js';

export const PROGRAM_METADATA_PROGRAM_ID = 'ProgM6JCCvbYkfKqJYHePx4xxSUSqJp7rh8Lyv7nk7S';
export const PROGRAM_METADATA_HEADER_BYTES = 96;

const METADATA_DISCRIMINATOR = 2;
const OFFSETS = Object.freeze({
  program: 1,
  authority: 33,
  mutable: 65,
  canonical: 66,
  seed: 67,
  encoding: 83,
  compression: 84,
  format: 85,
  dataSource: 86,
  dataLength: 87,
  data: PROGRAM_METADATA_HEADER_BYTES,
});

export function deriveCanonicalMetadataAddress(programId, seed = 'idl') {
  if (typeof seed !== 'string' || Buffer.byteLength(seed, 'utf8') === 0 || Buffer.byteLength(seed, 'utf8') > 16) {
    throw new Error('PROGRAM_METADATA_SEED_INVALID');
  }
  const seedBytes = Buffer.alloc(16);
  Buffer.from(seed, 'utf8').copy(seedBytes);
  const program = new PublicKey(programId);
  const metadataProgram = new PublicKey(PROGRAM_METADATA_PROGRAM_ID);
  const [address] = PublicKey.findProgramAddressSync(
    [program.toBuffer(), seedBytes],
    metadataProgram,
  );
  return address.toBase58();
}

export function parseMetadataAccount(accountData) {
  if (!Buffer.isBuffer(accountData) || accountData.length < PROGRAM_METADATA_HEADER_BYTES) {
    throw new Error('PROGRAM_METADATA_ACCOUNT_TRUNCATED');
  }
  if (accountData[0] !== METADATA_DISCRIMINATOR) {
    throw new Error('PROGRAM_METADATA_DISCRIMINATOR_INVALID');
  }

  const program = new PublicKey(accountData.subarray(OFFSETS.program, OFFSETS.authority)).toBase58();
  const authorityBytes = accountData.subarray(OFFSETS.authority, OFFSETS.mutable);
  const authority = authorityBytes.every(byte => byte === 0)
    ? null
    : new PublicKey(authorityBytes).toBase58();

  const mutableByte = accountData[OFFSETS.mutable];
  const canonicalByte = accountData[OFFSETS.canonical];
  if (![0, 1].includes(mutableByte) || ![0, 1].includes(canonicalByte)) {
    throw new Error('PROGRAM_METADATA_BOOLEAN_INVALID');
  }

  const seedBytes = accountData.subarray(OFFSETS.seed, OFFSETS.encoding);
  const seedEnd = seedBytes.indexOf(0);
  const seed = (seedEnd === -1 ? seedBytes : seedBytes.subarray(0, seedEnd)).toString('utf8');
  if (seedEnd !== -1 && seedBytes.subarray(seedEnd).some(byte => byte !== 0)) {
    throw new Error('PROGRAM_METADATA_SEED_PADDING_INVALID');
  }

  const encoding = accountData[OFFSETS.encoding];
  const compression = accountData[OFFSETS.compression];
  const format = accountData[OFFSETS.format];
  const dataSource = accountData[OFFSETS.dataSource];
  if (encoding > 3 || compression > 2 || format > 3 || dataSource > 2) {
    throw new Error('PROGRAM_METADATA_ENUM_INVALID');
  }

  const dataLength = accountData.readUInt32LE(OFFSETS.dataLength);
  if (dataLength === 0 || OFFSETS.data + dataLength > accountData.length) {
    throw new Error('PROGRAM_METADATA_DATA_LENGTH_INVALID');
  }

  return {
    program,
    authority,
    mutable: mutableByte === 1,
    canonical: canonicalByte === 1,
    seed,
    encoding,
    compression,
    format,
    dataSource,
    dataLength,
    data: accountData.subarray(OFFSETS.data, OFFSETS.data + dataLength),
    trailingAccountBytes: accountData.length - OFFSETS.data - dataLength,
  };
}
