import assert from 'node:assert/strict';
import test from 'node:test';
import { Keypair, PublicKey } from '@solana/web3.js';
import { SUBSCRIPTIONS_PROGRAM_ADDRESS } from '@solana/subscriptions';
import {
  ORIGINAL_SPL_TOKEN_PROGRAM_ADDRESS,
  TRANSFER_SUBSCRIPTION_DATA_LENGTH,
} from '../dist/transfer-subscription-instruction.js';
import { verifySubscriptionTransferTransaction } from '../dist/subscription-transaction-verifier.js';

const PROGRAM = SUBSCRIPTIONS_PROGRAM_ADDRESS;
const TOKEN = ORIGINAL_SPL_TOKEN_PROGRAM_ADDRESS;
const SYSTEM = '11111111111111111111111111111111';
const GENESIS = 'devnet-genesis-test-vector';
const SOURCE_COMMIT = '364a41976c33347d092902443bbec2def9227e75';
const ELF_SHA256 = 'a'.repeat(64);
const AMOUNT = 250n;
const PERIOD_START = 1_800_000_000n;
const PERIOD_END = PERIOD_START + 2_592_000n;
const CUMULATIVE = AMOUNT;

function key() {
  return Keypair.generate().publicKey.toBase58();
}

function makeFixture() {
  const subscriber = key();
  const merchant = key();
  const merchantFeePayer = key();
  const mint = key();
  const planPda = key();
  const [subscriptionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('subscription'), new PublicKey(planPda).toBytes(), new PublicKey(subscriber).toBytes()],
    new PublicKey(PROGRAM),
  );
  const [authorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('SubscriptionAuthority'), new PublicKey(subscriber).toBytes(), new PublicKey(mint).toBytes()],
    new PublicKey(PROGRAM),
  );
  const [sourceAta] = PublicKey.findProgramAddressSync(
    [
      new PublicKey(subscriber).toBytes(),
      new PublicKey(TOKEN).toBytes(),
      new PublicKey(mint).toBytes(),
    ],
    new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
  );
  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('event_authority')],
    new PublicKey(PROGRAM),
  );
  const destinationOwner = key();
  const expectedDestinationAta = key();
  const puller = merchant;
  const addresses = [
    subscriptionPda.toBase58(),
    planPda,
    authorityPda.toBase58(),
    sourceAta.toBase58(),
    expectedDestinationAta,
    puller,
    mint,
    TOKEN,
    eventAuthority.toBase58(),
    PROGRAM,
  ];
  const accountKeys = [merchantFeePayer, ...addresses];
  const accountIndex = address => accountKeys.indexOf(address);

  const instructionData = new Uint8Array(TRANSFER_SUBSCRIPTION_DATA_LENGTH);
  instructionData[0] = 10;
  new DataView(instructionData.buffer).setBigUint64(1, AMOUNT, true);
  instructionData.set(new PublicKey(subscriber).toBytes(), 9);
  instructionData.set(new PublicKey(mint).toBytes(), 41);

  const accountIndexes = addresses.map(accountIndex);
  const instruction = {
    programAddress: PROGRAM,
    programIdIndex: accountIndex(PROGRAM),
    accountIndexes,
    data: instructionData,
    accountAddresses: addresses,
    accounts: addresses.map((address, index) => ({
      address,
      isSigner: index === 5,
      isWritable: [0, 3, 4].includes(index),
    })),
  };

  const eventData = new Uint8Array(265);
  eventData.set([228, 69, 165, 46, 81, 203, 154, 29], 0);
  eventData[8] = 2;
  const putAddress = (address, offset) => eventData.set(new PublicKey(address).toBytes(), offset);
  putAddress(subscriptionPda.toBase58(), 9);
  putAddress(planPda, 41);
  putAddress(subscriber, 73);
  putAddress(mint, 105);
  const eventView = new DataView(eventData.buffer);
  eventView.setBigUint64(137, AMOUNT, true);
  eventView.setBigInt64(145, PERIOD_START, true);
  eventView.setBigInt64(153, PERIOD_END, true);
  eventView.setBigUint64(161, CUMULATIVE, true);
  putAddress(destinationOwner, 169);
  putAddress(expectedDestinationAta, 201);
  putAddress(puller, 233);

  const transferCpiData = new Uint8Array(10);
  transferCpiData[0] = 12;
  new DataView(transferCpiData.buffer).setBigUint64(1, AMOUNT, true);
  transferCpiData[9] = 6;

  const sourceIndex = accountIndex(sourceAta.toBase58());
  const destinationIndex = accountIndex(expectedDestinationAta);
  const balance = (accountIndex, owner, amountAtomic) => ({
    accountIndex,
    mint,
    owner,
    programAddress: TOKEN,
    amountAtomic: String(amountAtomic),
  });

  const signature = 'A'.repeat(88);
  const messageHash = 'b'.repeat(64);
  const evidence = {
    signature,
    messageHash,
    commitment: 'finalized',
    clusterGenesisHash: GENESIS,
    slot: 500n,
    blockTimeUnixSeconds: PERIOD_START + 1n,
    transactionError: null,
    programDeployment: {
      programAddress: PROGRAM,
      sourceCommit: SOURCE_COMMIT,
      elfSha256: ELF_SHA256,
      deploymentSlot: 400n,
      readAtSlot: 600n,
      readCommitment: 'finalized',
      attestationKind: 'current-finalized-programdata',
    },
    feePayer: merchantFeePayer,
    feePayerIsSigner: true,
    feePayerIsWritable: true,
    rpcProviderId: 'helius-devnet-test',
    rpcResponseHash: 'e'.repeat(64),
    accountKeys,
    topLevelInstructions: [instruction],
    innerInstructions: new Map([[0, [
      {
        programAddress: TOKEN,
        programIdIndex: accountIndex(TOKEN),
        accountIndexes: [sourceAta.toBase58(), mint, expectedDestinationAta, authorityPda.toBase58()].map(accountIndex),
        data: transferCpiData,
        accountAddresses: [sourceAta.toBase58(), mint, expectedDestinationAta, authorityPda.toBase58()],
        stackHeight: 2,
      },
      {
        programAddress: PROGRAM,
        programIdIndex: accountIndex(PROGRAM),
        accountIndexes: [accountIndex(eventAuthority.toBase58())],
        data: eventData,
        accountAddresses: [eventAuthority.toBase58()],
        stackHeight: 2,
      },
    ]]]),
    preTokenBalances: [
      balance(sourceIndex, subscriber, 1_000n),
      balance(destinationIndex, destinationOwner, 10n),
    ],
    postTokenBalances: [
      balance(sourceIndex, subscriber, 750n),
      balance(destinationIndex, destinationOwner, 260n),
    ],
  };

  const expected = {
    clusterGenesisHash: GENESIS,
    cycleId: 'cycle-test-001',
    attemptId: 'attempt-test-001',
    expectedSignature: signature,
    expectedMessageHash: messageHash,
    merchant,
    merchantFeePayer,
    subscriber,
    planPda,
    subscriptionPda: subscriptionPda.toBase58(),
    authorityPda: authorityPda.toBase58(),
    sourceAta: sourceAta.toBase58(),
    mint,
    mintDecimals: 6,
    planOwner: merchant,
    authorizedPullers: [],
    allowedDestinationOwners: [destinationOwner],
    expectedDestinationOwner: destinationOwner,
    expectedDestinationAta,
    expectedAmountAtomic: AMOUNT,
    expectedPeriodStartTs: PERIOD_START,
    expectedPeriodEndTs: PERIOD_END,
    expectedCumulativeAmountAtomic: CUMULATIVE,
    programSourceCommit: SOURCE_COMMIT,
    programElfSha256: ELF_SHA256,
  };

  return { expected, evidence };
}

test('returns only a verified transaction observation when instruction, CPI, event and token deltas agree', () => {
  const { expected, evidence } = makeFixture();
  const result = verifySubscriptionTransferTransaction(expected, evidence);

  assert.equal(result.outcome, 'verified_observation');
  assert.equal(result.amountAtomic, AMOUNT);
  assert.equal(result.puller, expected.planOwner);
  assert.equal(result.feePayer, expected.merchantFeePayer);
  assert.equal(result.rpcProviderId, evidence.rpcProviderId);
  assert.equal(result.rpcResponseHash, evidence.rpcResponseHash);
  assert.equal('paid' in result, false);
  assert.equal('entitled' in result, false);
});

test('returns UNKNOWN for a transaction that has not reached finalized commitment', () => {
  const { expected, evidence } = makeFixture();
  evidence.commitment = 'confirmed';
  const result = verifySubscriptionTransferTransaction(expected, evidence);
  assert.equal(result.outcome, 'unknown');
  assert.match(result.reasons.join(' '), /finalized commitment/);
});


test('rejects a transaction whose signed message hash does not match the durable Attempt', () => {
  const { expected, evidence } = makeFixture();
  evidence.messageHash = 'c'.repeat(64);
  const result = verifySubscriptionTransferTransaction(expected, evidence);
  assert.equal(result.outcome, 'rejected');
  assert.ok(result.failures.includes('attempt_message_mismatch'));
});

test('rejects a Program deployment hash that differs from the approved source build', () => {
  const { expected, evidence } = makeFixture();
  evidence.programDeployment.elfSha256 = 'd'.repeat(64);
  const result = verifySubscriptionTransferTransaction(expected, evidence);
  assert.equal(result.outcome, 'rejected');
  assert.ok(result.failures.includes('program_deployment_mismatch'));
});

test('rejects a token-balance delta that does not match the TransferChecked amount', () => {
  const { expected, evidence } = makeFixture();
  evidence.postTokenBalances[0].amountAtomic = '751';
  const result = verifySubscriptionTransferTransaction(expected, evidence);
  assert.equal(result.outcome, 'rejected');
  assert.ok(result.failures.includes('token_balance_delta_mismatch'));
});

test('returns UNKNOWN when exact-slot Program deployment provenance is absent', () => {
  const { expected, evidence } = makeFixture();
  evidence.programDeployment = null;
  const result = verifySubscriptionTransferTransaction(expected, evidence);
  assert.equal(result.outcome, 'unknown');
});

test('rejects a puller that is not the Plan Owner or an explicitly authorized Puller', () => {
  const { expected, evidence } = makeFixture();
  const unauthorizedPuller = key();
  const instruction = evidence.topLevelInstructions[0];
  const oldPuller = instruction.accountAddresses[5];
  const pullerIndex = evidence.accountKeys.indexOf(oldPuller);
  evidence.accountKeys[pullerIndex] = unauthorizedPuller;
  instruction.accountAddresses[5] = unauthorizedPuller;
  instruction.accounts[5].address = unauthorizedPuller;
  const event = evidence.innerInstructions.get(0)[1].data;
  event.set(new PublicKey(unauthorizedPuller).toBytes(), 233);
  const result = verifySubscriptionTransferTransaction(expected, evidence);
  assert.equal(result.outcome, 'rejected');
  assert.ok(result.failures.includes('puller_not_authorized'));
});

test('rejects a fee payer outside the explicit Merchant fee-payer policy', () => {
  const { expected, evidence } = makeFixture();
  evidence.feePayer = SYSTEM;
  evidence.accountKeys[0] = SYSTEM;
  const result = verifySubscriptionTransferTransaction(expected, evidence);
  assert.equal(result.outcome, 'rejected');
  assert.ok(result.failures.includes('fee_payer_mismatch'));
});

test('rejects additional inner instructions rather than ignoring extra CPI effects', () => {
  const { expected, evidence } = makeFixture();
  evidence.innerInstructions.set(0, [
    ...evidence.innerInstructions.get(0),
    { programAddress: TOKEN, data: new Uint8Array([1]), accountAddresses: [] },
  ]);
  const result = verifySubscriptionTransferTransaction(expected, evidence);
  assert.equal(result.outcome, 'rejected');
  assert.ok(result.failures.includes('token_cpi_missing_or_invalid'));
});

test('rejects a missing caller signer privilege', () => {
  const { expected, evidence } = makeFixture();
  evidence.topLevelInstructions[0].accounts[5].isSigner = false;
  const result = verifySubscriptionTransferTransaction(expected, evidence);
  assert.equal(result.outcome, 'rejected');
  assert.ok(result.failures.includes('instruction_privilege_invalid'));
});

test('returns UNKNOWN when the finalized ProgramData read is older than the transaction slot', () => {
  const { expected, evidence } = makeFixture();
  evidence.programDeployment.readAtSlot = 499n;
  const result = verifySubscriptionTransferTransaction(expected, evidence);
  assert.equal(result.outcome, 'unknown');
});

test('returns UNKNOWN when the current ProgramData deployment slot is newer than the transaction', () => {
  const { expected, evidence } = makeFixture();
  evidence.programDeployment.deploymentSlot = 501n;
  const result = verifySubscriptionTransferTransaction(expected, evidence);
  assert.equal(result.outcome, 'unknown');
});
