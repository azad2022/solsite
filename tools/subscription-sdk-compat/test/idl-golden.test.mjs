import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { address, createNoopSigner } from '@solana/kit';
import {
  getCreatePlanOverlayInstructionAsync,
  getInitSubscriptionAuthorityOverlayInstructionAsync,
  getSubscribeOverlayInstructionAsync,
} from '@solana/subscriptions';
import { PublicKey } from '@solana/web3.js';
import { kitInstructionToWeb3 } from '../dist/kit-to-web3.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/subscriptions-program-v0.5.0.json', import.meta.url), 'utf8'));
const PROGRAM_ID = fixture.source.programId;
const a = fixture.addresses;
const v = fixture.values;
const subscriberSigner = createNoopSigner(address(a.subscriber));
const merchantSigner = createNoopSigner(address(a.merchant));

function u8(value) { return Buffer.from([value]); }
function u64(value) { const out = Buffer.alloc(8); out.writeBigUInt64LE(BigInt(value)); return out; }
function i64(value) { const out = Buffer.alloc(8); out.writeBigInt64LE(BigInt(value)); return out; }
function pubkey(value) { return new PublicKey(value).toBuffer(); }
function fixedUtf8(value, size) {
  const encoded = Buffer.from(value, 'utf8');
  assert.ok(encoded.length <= size, 'fixture UTF-8 string must fit its IDL fixed-size field');
  return Buffer.concat([encoded, Buffer.alloc(size - encoded.length)]);
}

function deriveExpectedPdas() {
  const programId = new PublicKey(PROGRAM_ID);
  const [planPda, planBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('plan', 'utf8'), pubkey(a.merchant), u64(v.planId)],
    programId,
  );
  const [subscriptionAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('SubscriptionAuthority', 'utf8'), pubkey(a.subscriber), pubkey(a.mint)],
    programId,
  );
  const [subscriptionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('subscription', 'utf8'), planPda.toBuffer(), pubkey(a.subscriber)],
    programId,
  );
  const [eventAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('event_authority', 'utf8')],
    programId,
  );
  return {
    planPda: planPda.toBase58(),
    planBump,
    subscriptionAuthorityPda: subscriptionAuthorityPda.toBase58(),
    subscriptionPda: subscriptionPda.toBase58(),
    eventAuthorityPda: eventAuthorityPda.toBase58(),
    programId: programId.toBase58(),
  };
}

function expectedCreatePlanData() {
  const destinations = [a.destinationOwner, ...Array(v.planDestinationCapacity - 1).fill(a.zeroAddress)];
  const pullers = Array(v.planPullerCapacity).fill(a.zeroAddress);
  return Buffer.concat([
    u8(fixture.instructions.createPlan.discriminator),
    u64(v.planId),
    pubkey(a.mint),
    u64(v.amountAtomic),
    u64(v.periodHours),
    i64(v.planCreatedAt),
    i64(v.endTs),
    ...destinations.map(pubkey),
    ...pullers.map(pubkey),
    fixedUtf8(v.metadataUri, v.metadataUriBytes),
  ]);
}

function expectedSubscribeData(pdas) {
  return Buffer.concat([
    u8(fixture.instructions.subscribe.discriminator),
    u64(v.planId),
    u8(pdas.planBump),
    pubkey(a.mint),
    u64(v.amountAtomic),
    u64(v.periodHours),
    i64(v.expectedCreatedAt),
    i64(v.expectedSubscriptionAuthorityInitId),
  ]);
}

function expectedAccountMetas(scenario, pdas) {
  const refs = { ...a, ...pdas };
  return scenario.accounts.map((item) => ({
    name: item.name,
    address: item.addressRef === 'programId' ? PROGRAM_ID : refs[item.addressRef],
    role: item.role,
    isSigner: item.isSigner,
    isWritable: item.isWritable,
  }));
}

function assertAgainstIdlGolden(instruction, scenario, expectedData, pdas) {
  assert.equal(instruction.programAddress, PROGRAM_ID, 'Program ID must match the pinned Program IDL');
  assert.equal(expectedData.length, scenario.expectedByteLength, 'fixture length must match the pinned IDL layout');
  assert.deepEqual(Buffer.from(instruction.data), expectedData, 'SDK instruction bytes must match independent IDL serialization');
  const expected = expectedAccountMetas(scenario, pdas);
  assert.deepEqual(
    (instruction.accounts ?? []).map((account) => ({ address: account.address, role: account.role })),
    expected.map(({ address: accountAddress, role }) => ({ address: accountAddress, role })),
    'SDK account order and AccountRole values must match the IDL-derived fixture',
  );
  const converted = kitInstructionToWeb3(instruction);
  assert.equal(converted.programId.toBase58(), PROGRAM_ID);
  assert.deepEqual(Buffer.from(converted.data), expectedData, 'Adapter must preserve exact IDL instruction bytes');
  assert.deepEqual(
    converted.keys.map((key) => ({ address: key.pubkey.toBase58(), isSigner: key.isSigner, isWritable: key.isWritable })),
    expected.map(({ address: accountAddress, isSigner, isWritable }) => ({ address: accountAddress, isSigner, isWritable })),
    'Adapter must preserve IDL account order and signer/writable privileges',
  );
}

test('fixture provenance is pinned to the audited Program and SDK tags', () => {
  assert.equal(fixture.source.programCommit, '364a41976c33347d092902443bbec2def9227e75');
  assert.equal(fixture.source.sdkCommit, '5a347ffaa969036061d274d3c91e0277962e2b51');
  assert.equal(fixture.source.idlGitBlobSha, '208718e90bf9f8e7f42271b6e93284109b118172');
  assert.equal(PROGRAM_ID, 'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44');
});

test('InitSubscriptionAuthority bytes, accounts and privileges match the pinned IDL golden', async () => {
  const instruction = await getInitSubscriptionAuthorityOverlayInstructionAsync({
    owner: subscriberSigner,
    tokenMint: address(a.mint),
    tokenProgram: address(a.tokenProgram),
    userAta: address(a.userAta),
  });
  assertAgainstIdlGolden(
    instruction,
    fixture.instructions.initSubscriptionAuthority,
    Buffer.from([fixture.instructions.initSubscriptionAuthority.discriminator]),
    deriveExpectedPdas(),
  );
});

test('CreatePlan bytes, accounts and privileges match the pinned IDL golden', async () => {
  const instruction = await getCreatePlanOverlayInstructionAsync({
    owner: merchantSigner,
    planId: BigInt(v.planId),
    mint: address(a.mint),
    amount: BigInt(v.amountAtomic),
    periodHours: BigInt(v.periodHours),
    endTs: BigInt(v.endTs),
    destinations: [address(a.destinationOwner)],
    pullers: [],
    metadataUri: v.metadataUri,
    tokenProgram: address(a.tokenProgram),
  });
  assertAgainstIdlGolden(instruction, fixture.instructions.createPlan, expectedCreatePlanData(), deriveExpectedPdas());
});

test('Subscribe bytes, accounts and privileges match the pinned IDL golden', async () => {
  const pdas = deriveExpectedPdas();
  const instruction = await getSubscribeOverlayInstructionAsync({
    subscriber: subscriberSigner,
    merchant: address(a.merchant),
    planId: BigInt(v.planId),
    tokenMint: address(a.mint),
    expectedAmount: BigInt(v.amountAtomic),
    expectedPeriodHours: BigInt(v.periodHours),
    expectedCreatedAt: BigInt(v.expectedCreatedAt),
    expectedSubscriptionAuthorityInitId: BigInt(v.expectedSubscriptionAuthorityInitId),
  });
  assertAgainstIdlGolden(instruction, fixture.instructions.subscribe, expectedSubscribeData(pdas), pdas);
});
