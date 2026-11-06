import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  AddressLookupTableAccount,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { attestSubscriptionProgramDeployment } from '../../src/subscription-programdata-attestation.mjs';
import { deriveProgramDataAddress, UPGRADEABLE_LOADER_PROGRAM_ID } from '../../src/upgradeable-loader.mjs';

export const PROGRAM = 'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44';
export const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const ASSOCIATED_TOKEN = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
export const GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export const SOURCE_COMMIT = '364a41976c33347d092902443bbec2def9227e75';
export const ELF_BYTES = Buffer.from('solmint-pinned-program-elf-fixture-v1', 'utf8');
export const ELF_SHA256 = createHash('sha256').update(ELF_BYTES).digest('hex');
export const AMOUNT = 250n;
export const PERIOD_START = 1_800_000_000n;
export const PERIOD_END = PERIOD_START + 2_592_000n;

export function base58Encode(bytes) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) + BigInt(byte);
  let encoded = '';
  while (value > 0n) {
    const remainder = Number(value % 58n);
    encoded = alphabet[remainder] + encoded;
    value /= 58n;
  }
  let leading = 0;
  while (leading < bytes.length && bytes[leading] === 0) leading += 1;
  return '1'.repeat(leading) + encoded;
}



export function makeProgramDataRpcResponse(requestId, transactionSlot = 500n, readAtSlot = 600) {
  const programDataAddress = deriveProgramDataAddress(PROGRAM);
  const programState = Buffer.alloc(36);
  programState.writeUInt32LE(2, 0);
  new PublicKey(programDataAddress).toBuffer().copy(programState, 4);

  const programDataState = Buffer.alloc(13 + ELF_BYTES.length + 8);
  programDataState.writeUInt32LE(3, 0);
  programDataState.writeBigUInt64LE(400n, 4);
  programDataState[12] = 0;
  ELF_BYTES.copy(programDataState, 13);

  return JSON.stringify({
    jsonrpc: '2.0',
    id: requestId,
    result: {
      context: { slot: readAtSlot },
      value: [
        {
          data: [programState.toString('base64'), 'base64'],
          executable: true,
          owner: UPGRADEABLE_LOADER_PROGRAM_ID,
        },
        {
          data: [programDataState.toString('base64'), 'base64'],
          executable: false,
          owner: UPGRADEABLE_LOADER_PROGRAM_ID,
        },
      ],
    },
  });
}

export function makeProgramDataAttestation(transactionSlot) {
  const requestId = 'subscription-programdata-fixture';
  const raw = makeProgramDataRpcResponse(requestId, transactionSlot, 600);
  const result = attestSubscriptionProgramDeployment(raw, {
    requestId,
    providerId: 'helius-devnet-tests',
    requestedCommitment: 'finalized',
    transactionSlot,
    expectedSourceCommit: SOURCE_COMMIT,
    expectedElfSha256: ELF_SHA256,
  });
  assert.equal(result.outcome, 'attested');
  return result.attestation;
}
export function derivePda(seeds, programId = PROGRAM) {
  return PublicKey.findProgramAddressSync(
    seeds.map(seed => Buffer.from(seed)),
    new PublicKey(programId),
  )[0];
}

export function makeFixture({ versioned = false } = {}) {
  const merchant = Keypair.generate();
  const merchantFeePayer = Keypair.generate();
  const subscriber = Keypair.generate();
  const mint = new PublicKey('So11111111111111111111111111111111111111112');

  const planIdBytes = Buffer.alloc(8);
  planIdBytes.writeBigUInt64LE(7_301_030n);
  const planPda = derivePda([Buffer.from('plan'), merchant.publicKey.toBuffer(), planIdBytes]);
  const subscriptionPda = derivePda([
    Buffer.from('subscription'),
    planPda.toBuffer(),
    subscriber.publicKey.toBuffer(),
  ]);
  const authorityPda = derivePda([
    Buffer.from('SubscriptionAuthority'),
    subscriber.publicKey.toBuffer(),
    mint.toBuffer(),
  ]);
  const sourceAta = derivePda([
    subscriber.publicKey.toBuffer(),
    new PublicKey(TOKEN).toBuffer(),
    mint.toBuffer(),
  ], ASSOCIATED_TOKEN);
  const destinationAta = derivePda([
    merchant.publicKey.toBuffer(),
    new PublicKey(TOKEN).toBuffer(),
    mint.toBuffer(),
  ], ASSOCIATED_TOKEN);
  const eventAuthority = derivePda([Buffer.from('event_authority')]);
  const program = new PublicKey(PROGRAM);
  const tokenProgram = new PublicKey(TOKEN);
  const recentBlockhash = Keypair.generate().publicKey.toBase58();

  const instructionData = new Uint8Array(73);
  instructionData[0] = 10;
  new DataView(instructionData.buffer).setBigUint64(1, AMOUNT, true);
  instructionData.set(subscriber.publicKey.toBytes(), 9);
  instructionData.set(mint.toBytes(), 41);

  const instruction = new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: subscriptionPda, isSigner: false, isWritable: true },
      { pubkey: planPda, isSigner: false, isWritable: false },
      { pubkey: authorityPda, isSigner: false, isWritable: false },
      { pubkey: sourceAta, isSigner: false, isWritable: true },
      { pubkey: destinationAta, isSigner: false, isWritable: true },
      { pubkey: merchant.publicKey, isSigner: true, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
      { pubkey: eventAuthority, isSigner: false, isWritable: false },
      { pubkey: program, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(instructionData),
  });

  const tokenData = new Uint8Array(10);
  tokenData[0] = 12;
  new DataView(tokenData.buffer).setBigUint64(1, AMOUNT, true);
  tokenData[9] = 9;

  const eventData = new Uint8Array(265);
  eventData.set([228, 69, 165, 46, 81, 203, 154, 29], 0);
  eventData[8] = 2;
  const putAddress = (value, offset) => eventData.set(value.toBytes(), offset);
  putAddress(subscriptionPda, 9);
  putAddress(planPda, 41);
  putAddress(subscriber.publicKey, 73);
  putAddress(mint, 105);
  const eventView = new DataView(eventData.buffer);
  eventView.setBigUint64(137, AMOUNT, true);
  eventView.setBigInt64(145, PERIOD_START, true);
  eventView.setBigInt64(153, PERIOD_END, true);
  eventView.setBigUint64(161, AMOUNT, true);
  putAddress(merchant.publicKey, 169);
  putAddress(destinationAta, 201);
  putAddress(merchant.publicKey, 233);

  let transaction;
  let message;
  let staticKeys;
  let loadedAddresses = { writable: [], readonly: [] };

  if (versioned) {
    const lookupTable = new AddressLookupTableAccount({
      key: Keypair.generate().publicKey,
      state: {
        deactivationSlot: BigInt('18446744073709551615'),
        lastExtendedSlot: 0,
        lastExtendedSlotStartIndex: 0,
        authority: undefined,
        addresses: [destinationAta],
      },
    });
    message = new TransactionMessage({
      payerKey: merchantFeePayer.publicKey,
      recentBlockhash,
      instructions: [instruction],
    }).compileToV0Message([lookupTable]);
    transaction = new VersionedTransaction(message);
    transaction.sign([merchantFeePayer, merchant]);
    staticKeys = message.staticAccountKeys;
    loadedAddresses = { writable: [destinationAta.toBase58()], readonly: [] };
  } else {
    transaction = new Transaction({
      feePayer: merchantFeePayer.publicKey,
      recentBlockhash,
    }).add(instruction);
    transaction.sign(merchantFeePayer, merchant);
    message = transaction.compileMessage();
    staticKeys = message.accountKeys;
  }

  const accountKeys = [
    ...staticKeys,
    ...loadedAddresses.writable.map(value => new PublicKey(value)),
    ...loadedAddresses.readonly.map(value => new PublicKey(value)),
  ];
  const index = address => {
    const found = accountKeys.findIndex(candidate => candidate.equals(address));
    assert.notEqual(found, -1, 'fixture account must resolve in the compiled message');
    return found;
  };

  const topLevel = message.compiledInstructions[0];
  const outerAccountIndexes = Array.from(
    'accountKeyIndexes' in topLevel ? topLevel.accountKeyIndexes : topLevel.accounts,
  );
  const outerProgramIndex = topLevel.programIdIndex;
  const innerInstructions = [{
    index: 0,
    instructions: [
      {
        programIdIndex: index(tokenProgram),
        accounts: [index(sourceAta), index(mint), index(destinationAta), index(authorityPda)],
        data: base58Encode(tokenData),
        stackHeight: 2,
      },
      {
        programIdIndex: outerProgramIndex,
        accounts: [index(eventAuthority)],
        data: base58Encode(eventData),
        stackHeight: 2,
      },
    ],
  }];

  const balance = (accountIndex, owner, amountAtomic) => ({
    accountIndex,
    mint: mint.toBase58(),
    owner: owner.toBase58(),
    programId: TOKEN,
    uiTokenAmount: { amount: String(amountAtomic), decimals: 9, uiAmount: null, uiAmountString: '0' },
  });
  const meta = {
    err: null,
    fee: 5000,
    loadedAddresses,
    innerInstructions,
    preTokenBalances: [
      balance(index(sourceAta), subscriber.publicKey, 1_000n),
      balance(index(destinationAta), merchant.publicKey, 10n),
    ],
    postTokenBalances: [
      balance(index(sourceAta), subscriber.publicKey, 750n),
      balance(index(destinationAta), merchant.publicKey, 260n),
    ],
  };

  const wire = transaction.serialize();
  const signatures = versioned ? transaction.signatures : transaction.signatures.map(entry => entry.signature);
  const firstSignature = signatures[0];
  assert.ok(firstSignature instanceof Uint8Array);
  const signature = base58Encode(firstSignature);
  const messageBytes = message.serialize();
  const messageHash = createHash('sha256').update(Buffer.from(messageBytes)).digest('hex');
  const rawResponse = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    result: {
      blockTime: 1_800_000_001,
      meta,
      slot: 500,
      transaction: [Buffer.from(wire).toString('base64'), 'base64'],
      version: versioned ? 0 : 'legacy',
    },
  });

  const provenance = {
    requestedCommitment: 'finalized',
    clusterGenesisHash: GENESIS,
    providerId: 'helius-devnet-tests',
    requestId: 1,
    programDeployment: {
      ...makeProgramDataAttestation(500n),
    },
  };

  const expected = {
    clusterGenesisHash: GENESIS,
    cycleId: 'cycle-devnet-normalizer-test',
    attemptId: 'attempt-devnet-normalizer-test',
    expectedSignature: signature,
    expectedMessageHash: messageHash,
    merchant: merchant.publicKey.toBase58(),
    merchantFeePayer: merchantFeePayer.publicKey.toBase58(),
    subscriber: subscriber.publicKey.toBase58(),
    planPda: planPda.toBase58(),
    subscriptionPda: subscriptionPda.toBase58(),
    authorityPda: authorityPda.toBase58(),
    sourceAta: sourceAta.toBase58(),
    mint: mint.toBase58(),
    mintDecimals: 9,
    planOwner: merchant.publicKey.toBase58(),
    authorizedPullers: [],
    allowedDestinationOwners: [merchant.publicKey.toBase58()],
    expectedDestinationOwner: merchant.publicKey.toBase58(),
    expectedDestinationAta: destinationAta.toBase58(),
    expectedAmountAtomic: AMOUNT,
    expectedPeriodStartTs: PERIOD_START,
    expectedPeriodEndTs: PERIOD_END,
    expectedCumulativeAmountAtomic: AMOUNT,
    programSourceCommit: SOURCE_COMMIT,
    programElfSha256: ELF_SHA256,
  };

  return {
    rawResponse,
    provenance,
    expected,
    signature,
    messageHash,
    destinationAccountIndex: index(destinationAta),
    resolvedAccountKeys: accountKeys.map(value => value.toBase58()),
    outerAccountIndexes,
  };
}
