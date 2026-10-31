import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AccountRole,
  address,
  createNoopSigner,
  isSignerRole,
  isWritableRole,
} from '@solana/kit';
import {
  findPlanPda,
  findSubscriptionAuthorityPda,
  findSubscriptionDelegationPda,
  getCreatePlanOverlayInstructionAsync,
  getInitSubscriptionAuthorityOverlayInstructionAsync,
  getSubscribeOverlayInstructionAsync,
} from '@solana/subscriptions';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { kitInstructionToWeb3 } from '../dist/kit-to-web3.js';

const PROGRAM_ID = 'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const MINT = 'So11111111111111111111111111111111111111112';
const MERCHANT = 'SysvarRent111111111111111111111111111111111';
const SUBSCRIBER = 'SysvarC1ock11111111111111111111111111111111';
const DESTINATION_OWNER = 'Stake11111111111111111111111111111111111111';
const USER_ATA = 'Vote111111111111111111111111111111111111111';
const BLOCKHASH = SYSTEM_PROGRAM;
const PLAN_ID = 17n;
const PERIOD_HOURS = 720n;
const AMOUNT_ATOMIC = 1_250_000n;

// These signers are address-only test doubles. The SDK builders below only
// derive PDAs and attach signer account metadata; no signing method is invoked.
// Kit's noop signer satisfies the real TransactionSigner runtime contract while
// deliberately providing no private key and no usable cryptographic signature.
const merchantSigner = createNoopSigner(address(MERCHANT));
const subscriberSigner = createNoopSigner(address(SUBSCRIBER));

function expectedWeb3Meta(account) {
  return {
    pubkey: new PublicKey(account.address),
    isSigner: isSignerRole(account.role),
    isWritable: isWritableRole(account.role),
  };
}

function assertInstructionParity(kitInstruction, web3Instruction) {
  assert.ok(web3Instruction instanceof TransactionInstruction);
  assert.equal(web3Instruction.programId.toBase58(), kitInstruction.programAddress);
  assert.deepEqual(
    web3Instruction.keys.map((key) => ({
      pubkey: key.pubkey.toBase58(),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    (kitInstruction.accounts ?? []).map(expectedWeb3Meta).map((key) => ({
      pubkey: key.pubkey.toBase58(),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    'web3.js must preserve Kit account order, signer flags, and writable flags',
  );
  assert.deepEqual(
    Uint8Array.from(web3Instruction.data),
    Uint8Array.from(kitInstruction.data ?? []),
    'web3.js must preserve exact instruction bytes',
  );
}

function assertLegacyAndVersionedSerialization(web3Instruction, feePayer, expectedSignerCount) {
  const payer = new PublicKey(feePayer);
  // Solana message compilation always promotes the fee payer to writable signer,
  // even when that address was already present as a non-signer instruction meta.
  // Compare the serialized transaction against the effective compiled privileges,
  // while the separate parity assertion still checks exact pre-compile Kit metas.
  const effectiveKeys = web3Instruction.keys.map((key) => {
    const isFeePayer = key.pubkey.equals(payer);
    return {
      pubkey: key.pubkey.toBase58(),
      isSigner: key.isSigner || isFeePayer,
      isWritable: key.isWritable || isFeePayer,
    };
  });

  const legacy = new Transaction({
    feePayer: payer,
    recentBlockhash: BLOCKHASH,
  }).add(web3Instruction);
  const legacyWire = legacy.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  const legacyParsed = Transaction.from(legacyWire);
  assert.equal(legacyParsed.instructions.length, 1);
  assert.equal(
    legacyParsed.instructions[0].data.toString('hex'),
    web3Instruction.data.toString('hex'),
  );
  assert.deepEqual(
    legacyParsed.instructions[0].keys.map((key) => ({
      pubkey: key.pubkey.toBase58(),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    effectiveKeys,
  );

  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: BLOCKHASH,
    instructions: [web3Instruction],
  }).compileToV0Message();
  assert.equal(message.header.numRequiredSignatures, expectedSignerCount);

  const versioned = new VersionedTransaction(message);
  const versionedWire = versioned.serialize();
  const versionedParsed = VersionedTransaction.deserialize(versionedWire);
  assert.equal(versionedParsed.message.header.numRequiredSignatures, expectedSignerCount);

  const compiled = versionedParsed.message.compiledInstructions[0];
  assert.equal(Buffer.from(compiled.data).toString('hex'), web3Instruction.data.toString('hex'));
  const compiledAccounts = Array.from(compiled.accountKeyIndexes, (keyIndex) =>
    versionedParsed.message.staticAccountKeys[keyIndex].toBase58(),
  );
  assert.deepEqual(
    compiledAccounts,
    effectiveKeys.map((key) => key.pubkey),
    'v0 message compilation must preserve instruction account order',
  );
  assert.deepEqual(
    Array.from(compiled.accountKeyIndexes, (keyIndex) => {
      const key = versionedParsed.message.staticAccountKeys[keyIndex];
      return {
        pubkey: key.toBase58(),
        isSigner: keyIndex < versionedParsed.message.header.numRequiredSignatures,
        isWritable: keyIndex < versionedParsed.message.header.numRequiredSignatures
          ? keyIndex < versionedParsed.message.header.numRequiredSignatures - versionedParsed.message.header.numReadonlySignedAccounts
          : keyIndex < versionedParsed.message.staticAccountKeys.length - versionedParsed.message.header.numReadonlyUnsignedAccounts,
      };
    }),
    effectiveKeys,
    'v0 compiled privileges must match Solana fee-payer promotion and preserve account order',
  );
}

test('runtime imports the pinned SDK, Kit 7, and the installed web3.js version', () => {
  assert.equal(typeof getCreatePlanOverlayInstructionAsync, 'function');
  assert.equal(typeof getInitSubscriptionAuthorityOverlayInstructionAsync, 'function');
  assert.equal(typeof getSubscribeOverlayInstructionAsync, 'function');
  assert.equal(AccountRole.READONLY, 0);
  assert.equal(AccountRole.WRITABLE, 1);
  assert.equal(AccountRole.READONLY_SIGNER, 2);
  assert.equal(AccountRole.WRITABLE_SIGNER, 3);
  assert.equal(new PublicKey(PROGRAM_ID).toBase58(), PROGRAM_ID);
  assert.match(process.versions.node, /^2[24]\./, 'this spike intentionally runs only on Node 22 or 24');
});

test('SDK PDA derivation matches web3.js derivation for Plan, Authority, and Subscription', async () => {
  const [kitPlan] = await findPlanPda({
    owner: address(MERCHANT),
    planId: PLAN_ID,
  });
  const planIdLe = Buffer.alloc(8);
  planIdLe.writeBigUInt64LE(PLAN_ID);
  const [web3Plan] = PublicKey.findProgramAddressSync(
    [Buffer.from('plan', 'utf8'), new PublicKey(MERCHANT).toBuffer(), planIdLe],
    new PublicKey(PROGRAM_ID),
  );
  assert.equal(kitPlan, web3Plan.toBase58());

  const [kitAuthority] = await findSubscriptionAuthorityPda({
    user: address(SUBSCRIBER),
    tokenMint: address(MINT),
  });
  const [web3Authority] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('SubscriptionAuthority', 'utf8'),
      new PublicKey(SUBSCRIBER).toBuffer(),
      new PublicKey(MINT).toBuffer(),
    ],
    new PublicKey(PROGRAM_ID),
  );
  assert.equal(kitAuthority, web3Authority.toBase58());

  const [kitSubscription] = await findSubscriptionDelegationPda({
    planPda: kitPlan,
    subscriber: address(SUBSCRIBER),
  });
  const [web3Subscription] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('subscription', 'utf8'),
      new PublicKey(kitPlan).toBuffer(),
      new PublicKey(SUBSCRIBER).toBuffer(),
    ],
    new PublicKey(PROGRAM_ID),
  );
  assert.equal(kitSubscription, web3Subscription.toBase58());
});

test('Init Authority SDK instruction converts to web3.js without changing accounts or bytes', async () => {
  const kitInstruction = await getInitSubscriptionAuthorityOverlayInstructionAsync({
    owner: subscriberSigner,
    tokenMint: address(MINT),
    tokenProgram: address(TOKEN_PROGRAM),
    userAta: address(USER_ATA),
  });

  assert.equal(kitInstruction.programAddress, PROGRAM_ID);
  assert.equal(kitInstruction.data[0], 0, 'InitSubscriptionAuthority discriminator');
  const web3Instruction = kitInstructionToWeb3(kitInstruction);
  assertInstructionParity(kitInstruction, web3Instruction);
  assertLegacyAndVersionedSerialization(web3Instruction, SUBSCRIBER, 1);
});

test('Create Plan SDK instruction converts to web3.js without changing accounts or bytes', async () => {
  const kitInstruction = await getCreatePlanOverlayInstructionAsync({
    owner: merchantSigner,
    planId: PLAN_ID,
    mint: address(MINT),
    amount: AMOUNT_ATOMIC,
    periodHours: PERIOD_HOURS,
    endTs: 0n,
    destinations: [address(DESTINATION_OWNER)],
    pullers: [],
    metadataUri: 'https://solmint.ir/sdk-compatibility-fixture.json',
    tokenProgram: address(TOKEN_PROGRAM),
  });

  assert.equal(kitInstruction.programAddress, PROGRAM_ID);
  assert.equal(kitInstruction.data[0], 7, 'CreatePlan discriminator');
  const web3Instruction = kitInstructionToWeb3(kitInstruction);
  assertInstructionParity(kitInstruction, web3Instruction);
  assertLegacyAndVersionedSerialization(web3Instruction, MERCHANT, 1);
});

test('Subscribe SDK instruction uses the explicit observed init_id and converts to web3.js', async () => {
  const observedInitId = 123_456n; // Synthetic fixture value; never submitted to RPC.
  const kitInstruction = await getSubscribeOverlayInstructionAsync({
    subscriber: subscriberSigner,
    merchant: address(MERCHANT),
    planId: PLAN_ID,
    tokenMint: address(MINT),
    expectedAmount: AMOUNT_ATOMIC,
    expectedPeriodHours: PERIOD_HOURS,
    expectedCreatedAt: 10_000n,
    expectedSubscriptionAuthorityInitId: observedInitId,
  });

  assert.equal(kitInstruction.programAddress, PROGRAM_ID);
  assert.equal(kitInstruction.data[0], 11, 'Subscribe discriminator');
  const web3Instruction = kitInstructionToWeb3(kitInstruction);
  assertInstructionParity(kitInstruction, web3Instruction);
  assertLegacyAndVersionedSerialization(web3Instruction, SUBSCRIBER, 1);
});

test('adapter rejects unknown account roles and malformed data', () => {
  assert.throws(
    () => kitInstructionToWeb3({
      programAddress: PROGRAM_ID,
      accounts: [{ address: MERCHANT, role: 4 }],
      data: new Uint8Array([1]),
    }),
    /unsupported role/,
  );
  assert.throws(
    () => kitInstructionToWeb3({
      programAddress: PROGRAM_ID,
      accounts: [],
      data: [1, 2, 3],
    }),
    /Uint8Array/,
  );
});
