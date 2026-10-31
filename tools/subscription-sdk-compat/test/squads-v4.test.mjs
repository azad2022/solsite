import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { PublicKey } from '@solana/web3.js';
import {
  deriveSquadsV4MultisigStateAddress,
  deriveSquadsV4VaultAddress,
  parseSquadsV4MultisigAccount,
  SQUADS_V4_MAX_TIME_LOCK_SECONDS,
  SQUADS_V4_MULTISIG_STATE_ADDRESS,
  SQUADS_V4_PROGRAM_ID,
  SQUADS_V4_VAULT_ADDRESS,
} from '../src/squads-v4.mjs';

function accountFixture({ rentCollector = null, threshold = 2, timeLockSeconds = 120, members } = {}) {
  const sortedMembers = (members ?? [
    { key: new PublicKey(new Uint8Array(32).fill(1)), permissions: 7 },
    { key: new PublicKey(new Uint8Array(32).fill(2)), permissions: 7 },
    { key: new PublicKey(new Uint8Array(32).fill(3)), permissions: 1 },
  ]).slice().sort((a, b) => Buffer.compare(a.key.toBuffer(), b.key.toBuffer()));

  const discriminator = createHash('sha256').update('account:Multisig', 'utf8').digest().subarray(0, 8);
  const createKey = new PublicKey(new Uint8Array(32).fill(9));
  const configAuthority = PublicKey.default;
  const optionBytes = rentCollector ? 33 : 1;
  const serializedLength = 8 + 32 + 32 + 2 + 4 + 8 + 8 + optionBytes + 1 + 4 + sortedMembers.length * 33;
  const allocatedLength = 8 + 32 + 32 + 2 + 4 + 8 + 8 + 1 + 32 + 1 + 4 + sortedMembers.length * 33;
  const data = Buffer.alloc(allocatedLength);
  let offset = 0;
  discriminator.copy(data, offset); offset += 8;
  createKey.toBuffer().copy(data, offset); offset += 32;
  configAuthority.toBuffer().copy(data, offset); offset += 32;
  data.writeUInt16LE(threshold, offset); offset += 2;
  data.writeUInt32LE(timeLockSeconds, offset); offset += 4;
  data.writeBigUInt64LE(23n, offset); offset += 8;
  data.writeBigUInt64LE(17n, offset); offset += 8;
  if (rentCollector) {
    data[offset++] = 1;
    rentCollector.toBuffer().copy(data, offset); offset += 32;
  } else {
    data[offset++] = 0;
  }
  data[offset++] = 254;
  data.writeUInt32LE(sortedMembers.length, offset); offset += 4;
  for (const member of sortedMembers) {
    member.key.toBuffer().copy(data, offset); offset += 32;
    data[offset++] = member.permissions;
  }
  assert.equal(offset, serializedLength);
  return { data, createKey: createKey.toBase58() };
}

test('known Mainnet Squads v4 state/vault pair derives exactly', () => {
  const derived = deriveSquadsV4VaultAddress(SQUADS_V4_MULTISIG_STATE_ADDRESS);
  assert.equal(derived.address, SQUADS_V4_VAULT_ADDRESS);
  assert.equal(new PublicKey(SQUADS_V4_PROGRAM_ID).toBase58(), SQUADS_V4_PROGRAM_ID);
});

test('Squads v4 state PDA derives from fixed seeds and create_key', () => {
  const fixture = accountFixture();
  const first = deriveSquadsV4MultisigStateAddress(fixture.createKey);
  const second = deriveSquadsV4MultisigStateAddress(fixture.createKey);
  assert.deepEqual(first, second);
  assert.equal(new PublicKey(first.address).toBase58(), first.address);
});

test('Squads v4 Borsh parser extracts governance threshold, members and permissions', () => {
  const fixture = accountFixture();
  const parsed = parseSquadsV4MultisigAccount(fixture.data);
  assert.equal(parsed.threshold, 2);
  assert.equal(parsed.timeLockSeconds, 120);
  assert.equal(parsed.transactionIndex, '23');
  assert.equal(parsed.staleTransactionIndex, '17');
  assert.equal(parsed.configAuthorityIsDefault, true);
  assert.equal(parsed.rentCollector, null);
  assert.equal(parsed.memberCount, 3);
  assert.equal(parsed.voterCount, 2);
  assert.equal(parsed.proposerCount, 3);
  assert.equal(parsed.executorCount, 2);
  assert.equal(parsed.members[0].permissions.mask, 7);
  assert.equal(parsed.members[2].permissions.mask, 1);
  assert.ok(parsed.trailingAllocatedBytes >= 0);
});

test('Squads v4 Borsh parser handles an optional rent collector', () => {
  const collector = new PublicKey(new Uint8Array(32).fill(8));
  const parsed = parseSquadsV4MultisigAccount(accountFixture({ rentCollector: collector }).data);
  assert.equal(parsed.rentCollector, collector.toBase58());
});

test('Squads v4 Borsh parser rejects invalid discriminator, permission, thresholds and truncated members', () => {
  const wrongDiscriminator = accountFixture().data;
  wrongDiscriminator[0] ^= 0xff;
  assert.throws(() => parseSquadsV4MultisigAccount(wrongDiscriminator), /SQUADS_V4_MULTISIG_DISCRIMINATOR_INVALID/);

  const invalidPermission = accountFixture().data;
  invalidPermission[invalidPermission.length - 32] = 8;
  assert.throws(() => parseSquadsV4MultisigAccount(invalidPermission), /SQUADS_V4_MEMBER_PERMISSION_MASK_INVALID/);

  assert.throws(() => parseSquadsV4MultisigAccount(accountFixture({ threshold: 4 }).data), /SQUADS_V4_THRESHOLD_INVALID/);
  assert.throws(() => parseSquadsV4MultisigAccount(Buffer.alloc(100)), /SQUADS_V4_MULTISIG_ACCOUNT_TRUNCATED/);
});
