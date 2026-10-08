import assert from 'node:assert/strict';
import test from 'node:test';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { buildBulkPayoutTransaction } from '../src/pay/services/bulkPayoutTransactionBuilder';
import { verifyBulkPayoutTransaction } from '../src/pay/services/bulkPayoutPolicy';
import type { ObservedPaymentTransaction } from '../src/pay/services/verificationPolicy';

const SOURCE='11111111111111111111111111111111';
const A='22222222222222222222222222222222';
const B='33333333333333333333333333333333';

function observed(transfers:ObservedPaymentTransaction['transfers'], overrides:Partial<ObservedPaymentTransaction>={}):ObservedPaymentTransaction {
  return {
    signature:'5'.repeat(88), slot:100, blockTime:null, networkFeeLamports:'5000', success:true,
    commitment:'finalized', feePayer:SOURCE, referenceMatched:false, transfers, ...overrides,
  };
}

test('Bulk Pay verifier accepts an exact finalized SOL batch',()=>{
  const result=verifyBulkPayoutTransaction({
    sourceWalletAddress:SOURCE,asset:'SOL',tokenMint:null,tokenProgram:null,tokenDecimals:null,totalAmountAtomic:'3000',itemCount:2,
    verificationCommitment:'finalized',items:[{recipient:A,amountAtomic:'1000'},{recipient:B,amountAtomic:'2000'}],
  },observed([
    {role:'other',source:SOURCE,sourceAuthority:SOURCE,destination:A,destinationAuthority:A,asset:'SOL',tokenMint:null,tokenProgram:null,tokenDecimals:null,amountAtomic:'1000',instructionIndex:1000000},
    {role:'other',source:SOURCE,sourceAuthority:SOURCE,destination:B,destinationAuthority:B,asset:'SOL',tokenMint:null,tokenProgram:null,tokenDecimals:null,amountAtomic:'2000',instructionIndex:1000001},
  ]));
  assert.equal(result.valid,true);
  assert.equal(result.reason,'OK');
  assert.equal(result.matchedItemCount,2);
});

test('Bulk Pay verifier rejects an extra supported transfer',()=>{
  const result=verifyBulkPayoutTransaction({
    sourceWalletAddress:SOURCE,asset:'SOL',tokenMint:null,tokenProgram:null,tokenDecimals:null,totalAmountAtomic:'3000',itemCount:2,
    verificationCommitment:'finalized',items:[{recipient:A,amountAtomic:'1000'},{recipient:B,amountAtomic:'2000'}],
  },observed([
    {role:'other',source:SOURCE,sourceAuthority:SOURCE,destination:A,destinationAuthority:A,asset:'SOL',tokenMint:null,tokenProgram:null,tokenDecimals:null,amountAtomic:'1000',instructionIndex:1000000},
    {role:'other',source:SOURCE,sourceAuthority:SOURCE,destination:B,destinationAuthority:B,asset:'SOL',tokenMint:null,tokenProgram:null,tokenDecimals:null,amountAtomic:'2000',instructionIndex:1000001},
    {role:'other',source:SOURCE,sourceAuthority:SOURCE,destination:A,destinationAuthority:A,asset:'SOL',tokenMint:null,tokenProgram:null,tokenDecimals:null,amountAtomic:'1',instructionIndex:1000002},
  ]));
  assert.equal(result.valid,false);
  assert.equal(result.reason,'ITEM_COUNT_MISMATCH');
});

test('Bulk Pay verifier rejects wrong source wallet',()=>{
  const result=verifyBulkPayoutTransaction({
    sourceWalletAddress:SOURCE,asset:'SOL',tokenMint:null,tokenProgram:null,tokenDecimals:null,totalAmountAtomic:'1000',itemCount:1,
    verificationCommitment:'finalized',items:[{recipient:A,amountAtomic:'1000'}],
  },observed([{role:'other',source:'44444444444444444444444444444444',sourceAuthority:'44444444444444444444444444444444',destination:A,destinationAuthority:A,asset:'SOL',tokenMint:null,tokenProgram:null,tokenDecimals:null,amountAtomic:'1000',instructionIndex:1000000}],{feePayer:'44444444444444444444444444444444'}));
  assert.equal(result.valid,false);
  assert.equal(result.reason,'SOURCE_MISMATCH');
});

test('Bulk Pay verifier rejects duplicate ambiguous transfers',()=>{
  const result=verifyBulkPayoutTransaction({
    sourceWalletAddress:SOURCE,asset:'SOL',tokenMint:null,tokenProgram:null,tokenDecimals:null,totalAmountAtomic:'2000',itemCount:2,
    verificationCommitment:'finalized',items:[{recipient:A,amountAtomic:'1000'},{recipient:A,amountAtomic:'1000'}],
  },observed([
    {role:'other',source:SOURCE,sourceAuthority:SOURCE,destination:A,destinationAuthority:A,asset:'SOL',tokenMint:null,tokenProgram:null,tokenDecimals:null,amountAtomic:'1000',instructionIndex:1000000},
    {role:'other',source:SOURCE,sourceAuthority:SOURCE,destination:A,destinationAuthority:A,asset:'SOL',tokenMint:null,tokenProgram:null,tokenDecimals:null,amountAtomic:'1000',instructionIndex:1000001},
  ]));
  assert.equal(result.valid,false);
  assert.equal(result.reason,'AMBIGUOUS_TRANSFER');
});

test('Bulk Pay transaction builder binds fee payer and exact instructions',async()=>{
  const latest={blockhash:'9'.repeat(32),lastValidBlockHeight:123};
  const connection={getLatestBlockhash:async()=>latest} as unknown as Connection;
  const encoded=await buildBulkPayoutTransaction({
    sourceWalletAddress:SOURCE,asset:'SOL',tokenMint:null,tokenProgram:null,tokenDecimals:null,totalAmountAtomic:'3000',itemCount:2,
  },[{recipient:A,amountAtomic:'1000'},{recipient:B,amountAtomic:'2000'}],connection);
  const transaction=Transaction.from(Uint8Array.from(atob(encoded),char=>char.charCodeAt(0)));
  assert.equal(transaction.feePayer?.toBase58(),SOURCE);
  assert.equal(transaction.recentBlockhash,latest.blockhash);
  assert.equal(transaction.instructions.length,2);
  assert.deepEqual(transaction.instructions.map(instruction=>instruction.programId.toBase58()),[SystemProgram.programId.toBase58(),SystemProgram.programId.toBase58()]);
  assert.equal(new PublicKey(A).equals(transaction.instructions[0].keys[1].pubkey),true);
});
