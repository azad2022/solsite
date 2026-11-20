import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicKey } from '@solana/web3.js';
import {
  assertApprovedMainnetRpcUrl,
  SOLANA_MAINNET_GENESIS_HASH,
  parseProgramDataAccount,
  readProgramDataAddress,
  stripTrailingZeroBytes,
} from '../src/upgradeable-loader.mjs';

function programDataFixture({ authority = null, elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46]) } = {}) {
  const headerLength = authority ? 45 : 13;
  const bytes = Buffer.alloc(headerLength + elf.length);
  bytes.writeUInt32LE(3, 0);
  bytes.writeBigUInt64LE(123456789n, 4);
  bytes[12] = authority ? 1 : 0;
  if (authority) Buffer.from(new PublicKey(authority).toBuffer()).copy(bytes, 13);
  elf.copy(bytes, headerLength);
  return bytes;
}

test('Upgradeable Loader Program state decodes the ProgramData address', () => {
  const expected = new PublicKey(new Uint8Array(32).fill(7));
  const data = Buffer.alloc(36);
  data.writeUInt32LE(2, 0);
  expected.toBuffer().copy(data, 4);
  assert.equal(readProgramDataAddress(data), expected.toBase58());
});

test('Upgradeable Loader Program state rejects wrong discriminator and length', () => {
  const wrongTag = Buffer.alloc(36);
  wrongTag.writeUInt32LE(3, 0);
  assert.throws(() => readProgramDataAddress(wrongTag), /PROGRAM_STATE_TAG_INVALID/);
  assert.throws(() => readProgramDataAddress(Buffer.alloc(35)), /PROGRAM_STATE_LENGTH_INVALID/);
});

test('ProgramData parses deployment slot, upgrade authority and ELF bytes', () => {
  const authority = new PublicKey(new Uint8Array(32).fill(9)).toBase58();
  const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x01, 0x02]);
  const parsed = parseProgramDataAccount(programDataFixture({ authority, elf }));
  assert.equal(parsed.deploymentSlot, '123456789');
  assert.equal(parsed.upgradeAuthority, authority);
  assert.deepEqual(parsed.elfBytes, elf);
});

test('ProgramData supports immutable deployment with no upgrade authority', () => {
  const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);
  const parsed = parseProgramDataAccount(programDataFixture({ elf }));
  assert.equal(parsed.deploymentSlot, '123456789');
  assert.equal(parsed.upgradeAuthority, null);
  assert.deepEqual(parsed.elfBytes, elf);
});

test('ProgramData rejects malformed state, authority option and truncated ELF', () => {
  const wrongTag = Buffer.alloc(20);
  wrongTag.writeUInt32LE(2, 0);
  assert.throws(() => parseProgramDataAccount(wrongTag), /PROGRAM_DATA_STATE_TAG_INVALID/);

  const invalidOption = Buffer.alloc(14);
  invalidOption.writeUInt32LE(3, 0);
  invalidOption.writeBigUInt64LE(1n, 4);
  invalidOption[12] = 2;
  assert.throws(() => parseProgramDataAccount(invalidOption), /PROGRAM_DATA_AUTHORITY_OPTION_INVALID/);

  const truncatedAuthority = Buffer.alloc(45);
  truncatedAuthority.writeUInt32LE(3, 0);
  truncatedAuthority.writeBigUInt64LE(1n, 4);
  truncatedAuthority[12] = 1;
  assert.throws(() => parseProgramDataAccount(truncatedAuthority), /PROGRAM_DATA_AUTHORITY_TRUNCATED/);

  const noElf = Buffer.alloc(13);
  noElf.writeUInt32LE(3, 0);
  noElf.writeBigUInt64LE(1n, 4);
  noElf[12] = 0;
  assert.throws(() => parseProgramDataAccount(noElf), /PROGRAM_DATA_LENGTH_INVALID/);
});

test('Mainnet RPC policy accepts HTTPS Helius and rejects public or insecure endpoints', () => {
  assert.equal(assertApprovedMainnetRpcUrl('https://mainnet.helius-rpc.com/'), true);
  assert.equal(assertApprovedMainnetRpcUrl('https://tenant.helius-rpc.com/rpc'), true);
  assert.throws(() => assertApprovedMainnetRpcUrl('https://api.mainnet-beta.solana.com'), /MAINNET_HELIUS_RPC_REQUIRED/);
  assert.throws(() => assertApprovedMainnetRpcUrl('http://mainnet.helius-rpc.com'), /MAINNET_RPC_HTTPS_REQUIRED/);
  assert.throws(() => assertApprovedMainnetRpcUrl('not-a-url'), /MAINNET_RPC_URL_FORMAT_INVALID/);
  assert.throws(() => assertApprovedMainnetRpcUrl(''), /MAINNET_RPC_URL_MISSING/);
});

test('executable hash input strips trailing ProgramData zero padding', () => {
  const padded = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x00, 0x00]);
  assert.deepEqual(stripTrailingZeroBytes(padded), Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
  assert.deepEqual(stripTrailingZeroBytes(Buffer.from([0x7f, 0x00, 0x01])), Buffer.from([0x7f, 0x00, 0x01]));
  assert.throws(() => stripTrailingZeroBytes(Buffer.alloc(4)), /PROGRAM_BYTES_EMPTY_AFTER_ZERO_PADDING/);
});

test('Mainnet genesis hash matches the canonical Solana mainnet value', () => {
  assert.equal(SOLANA_MAINNET_GENESIS_HASH, '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d');
});
