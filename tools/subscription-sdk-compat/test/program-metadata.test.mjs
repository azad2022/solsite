import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import test from 'node:test';
import { PublicKey } from '@solana/web3.js';
import {
  deriveCanonicalMetadataAddress,
  parseMetadataAccount,
  PROGRAM_METADATA_HEADER_BYTES,
  PROGRAM_METADATA_PROGRAM_ID,
} from '../src/program-metadata.mjs';

const TARGET_PROGRAM_ID = 'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44';

function metadataFixture({ seed = 'idl', program = TARGET_PROGRAM_ID, content = '{"kind":"rootNode"}' } = {}) {
  const compressed = deflateSync(Buffer.from(content, 'utf8'));
  const bytes = Buffer.alloc(PROGRAM_METADATA_HEADER_BYTES + compressed.length);
  bytes[0] = 2;
  new PublicKey(program).toBuffer().copy(bytes, 1);
  bytes[65] = 1;
  bytes[66] = 1;
  Buffer.from(seed, 'utf8').copy(bytes, 67);
  bytes[83] = 1;
  bytes[84] = 2;
  bytes[85] = 1;
  bytes[86] = 0;
  bytes.writeUInt32LE(compressed.length, 87);
  compressed.copy(bytes, PROGRAM_METADATA_HEADER_BYTES);
  return bytes;
}

test('canonical Program Metadata PDA derives using program, zero authority and fixed 16-byte seed', () => {
  const first = deriveCanonicalMetadataAddress(TARGET_PROGRAM_ID, 'idl');
  const second = deriveCanonicalMetadataAddress(TARGET_PROGRAM_ID, 'idl');
  assert.equal(first, second);
  assert.equal(new PublicKey(first).toBase58(), first);
  assert.equal(new PublicKey(PROGRAM_METADATA_PROGRAM_ID).toBase58(), PROGRAM_METADATA_PROGRAM_ID);
  assert.throws(() => deriveCanonicalMetadataAddress(TARGET_PROGRAM_ID, ''), /PROGRAM_METADATA_SEED_INVALID/);
  assert.throws(() => deriveCanonicalMetadataAddress(TARGET_PROGRAM_ID, '12345678901234567'), /PROGRAM_METADATA_SEED_INVALID/);
});

test('Program Metadata account parser validates canonical IDL fields and extracts compressed data', () => {
  const parsed = parseMetadataAccount(metadataFixture());
  assert.equal(parsed.program, TARGET_PROGRAM_ID);
  assert.equal(parsed.authority, null);
  assert.equal(parsed.mutable, true);
  assert.equal(parsed.canonical, true);
  assert.equal(parsed.seed, 'idl');
  assert.equal(parsed.encoding, 1);
  assert.equal(parsed.compression, 2);
  assert.equal(parsed.format, 1);
  assert.equal(parsed.dataSource, 0);
  assert.ok(parsed.data.length > 0);
  assert.equal(parsed.trailingAccountBytes, 0);
});

test('Program Metadata account parser rejects invalid discriminator and malformed headers', () => {
  const invalidDiscriminator = metadataFixture();
  invalidDiscriminator[0] = 1;
  assert.throws(() => parseMetadataAccount(invalidDiscriminator), /PROGRAM_METADATA_DISCRIMINATOR_INVALID/);
  assert.throws(() => parseMetadataAccount(Buffer.alloc(PROGRAM_METADATA_HEADER_BYTES - 1)), /PROGRAM_METADATA_ACCOUNT_TRUNCATED/);
});

test('Program Metadata account parser rejects invalid booleans, enums, seeds and data lengths', () => {
  const invalidBoolean = metadataFixture();
  invalidBoolean[65] = 2;
  assert.throws(() => parseMetadataAccount(invalidBoolean), /PROGRAM_METADATA_BOOLEAN_INVALID/);

  const invalidEnum = metadataFixture();
  invalidEnum[84] = 3;
  assert.throws(() => parseMetadataAccount(invalidEnum), /PROGRAM_METADATA_ENUM_INVALID/);

  const invalidSeedPadding = metadataFixture();
  invalidSeedPadding[68] = 0;
  invalidSeedPadding[69] = 1;
  assert.throws(() => parseMetadataAccount(invalidSeedPadding), /PROGRAM_METADATA_SEED_PADDING_INVALID/);

  const invalidLength = metadataFixture();
  invalidLength.writeUInt32LE(0xffffffff, 87);
  assert.throws(() => parseMetadataAccount(invalidLength), /PROGRAM_METADATA_DATA_LENGTH_INVALID/);
});
