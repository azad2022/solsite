import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeBase58 } from '../src/pay/services/base58';
import {
  parsePendingBulkPayoutSubmissions,
  pendingBulkPayoutStorageKey,
  serializePendingBulkPayoutSubmissions,
  type PendingBulkPayoutSubmission,
} from '../src/pay/services/bulkPayoutPendingSubmission';

const BATCH_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BATCH_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const KEY_A='11111111-1111-4111-8111-111111111111';
const KEY_B='22222222-2222-4222-8222-222222222222';
const SIGNATURE=encodeBase58(Uint8Array.from({length:64},(_,index)=>index+1));

function pending(batchId:string,idempotencyKey:string):PendingBulkPayoutSubmission {
  return {batchId,signature:SIGNATURE,idempotencyKey};
}

test('pending Bulk Pay submissions round-trip across page reloads and preserve separate batches',()=>{
  const values={ [BATCH_A]:pending(BATCH_A,KEY_A), [BATCH_B]:pending(BATCH_B,KEY_B) };
  const parsed=parsePendingBulkPayoutSubmissions(serializePendingBulkPayoutSubmissions(values));
  assert.deepEqual(parsed,values);
  assert.equal(Object.keys(parsed).length,2);
});

test('pending submission parser discards malformed records',()=>{
  const raw=JSON.stringify([
    pending(BATCH_A,KEY_A),
    {...pending(BATCH_B,KEY_B),signature:'not-base58'},
    {...pending(BATCH_B,KEY_B),idempotencyKey:'not-a-uuid'},
    {batchId:'bad',signature:SIGNATURE,idempotencyKey:KEY_A},
    null,
  ]);
  const parsed=parsePendingBulkPayoutSubmissions(raw);
  assert.deepEqual(Object.keys(parsed),[BATCH_A]);
  assert.equal(parsed[BATCH_A].signature,SIGNATURE);
});

test('pending submission parser safely handles invalid JSON and unexpected shapes',()=>{
  assert.deepEqual(parsePendingBulkPayoutSubmissions('{invalid'),{});
  assert.deepEqual(parsePendingBulkPayoutSubmissions(JSON.stringify({batchId:BATCH_A})),{});
  assert.deepEqual(parsePendingBulkPayoutSubmissions(null),{});
});

test('pending submission storage keys are isolated by merchant',()=>{
  assert.notEqual(pendingBulkPayoutStorageKey('merchant-a'),pendingBulkPayoutStorageKey('merchant-b'));
});
