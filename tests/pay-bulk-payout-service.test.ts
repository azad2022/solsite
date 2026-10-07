import test from 'node:test';
import assert from 'node:assert/strict';
import { createBulkPayoutService } from '../src/pay/services/bulkPayoutService';
import { encodeBase58 } from '../src/pay/components/base58';
import type { PayHttpClient } from '../src/pay/http';

function mockClient(handler:(path:string,init?:RequestInit)=>unknown):PayHttpClient{
  return { request: async (path:string,init?:RequestInit)=>handler(path,init) } as unknown as PayHttpClient;
}

const row = {
  id:'00000000-0000-4000-8000-000000000001',
  merchantId:'00000000-0000-4000-8000-000000000002',
  createdByUserId:'user-1',
  asset:'USDC',
  tokenMint:'Mint111111111111111111111111111111111111111',
  tokenProgram:'spl-token',
  tokenDecimals:6,
  sourceWalletAddress:'11111111111111111111111111111111',
  totalAmountAtomic:'1500000',
  itemCount:2,
  status:'ready',
  transactionSignature:null,
  transactionSlot:null,
  transactionBlockTime:null,
  failureCode:null,
  failureReason:null,
  verificationCommitment:'finalized',
  verificationSummary:{},
  createdAt:'2026-10-07T00:00:00.000Z',
  updatedAt:'2026-10-07T00:00:00.000Z',
  items:[
    { id:'00000000-0000-4000-8000-000000000011',batchId:'00000000-0000-4000-8000-000000000001',lineNumber:1,recipient:'11111111111111111111111111111111',amountAtomic:'1000000',status:'ready',failureCode:null,failureReason:null,createdAt:'2026-10-07T00:00:00.000Z',updatedAt:'2026-10-07T00:00:00.000Z' },
    { id:'00000000-0000-4000-8000-000000000012',batchId:'00000000-0000-4000-8000-000000000001',lineNumber:2,recipient:'11111111111111111111111111111111',amountAtomic:'500000',status:'ready',failureCode:null,failureReason:null,createdAt:'2026-10-07T00:00:00.000Z',updatedAt:'2026-10-07T00:00:00.000Z' },
  ],
};

test('Bulk Pay service rejects malformed server detail', async () => {
  const service=createBulkPayoutService(mockClient(async()=>({apiVersion:'v1',data:{...row,status:'nonsense'}})));
  await assert.rejects(() => service.get(row.merchantId,row.id), /Invalid Bulk Pay batch status/);
});

test('Bulk Pay service preserves exact atomic strings', async () => {
  const service=createBulkPayoutService(mockClient(async()=>({apiVersion:'v1',data:row})));
  const batch=await service.get(row.merchantId,row.id);
  assert.equal(batch.totalAmountAtomic,'1500000');
  assert.equal(batch.items[1].amountAtomic,'500000');
});

test('Bulk Pay transaction request sends merchant and wallet account through the central service', async () => {
  let seenPath='';
  let seenBody='';
  const service=createBulkPayoutService(mockClient(async(path,init)=>{
    seenPath=path;
    seenBody=String(init?.body??'');
    return {success:true,transaction:'AQID',sizeBytes:481,message:'ready'};
  }));
  const result=await service.transactionRequest(row.merchantId,row.id,'11111111111111111111111111111111');
  assert.equal(result.sizeBytes,481);
  assert.match(seenPath,/transaction-request/);
  assert.match(seenPath,/merchantId=/);
  assert.equal(seenBody,'{"account":"11111111111111111111111111111111"}');
});


test('Bulk Pay create and submit bind mutations to explicit stable idempotency keys', async () => {
  const calls: Array<{path:string;headers:Headers;method:string}> = [];
  const client = mockClient(async (path, init) => {
    calls.push({path, headers:new Headers(init?.headers), method:init?.method ?? 'GET'});
    if(path.includes('/payout-batches?merchantId=')) {
      return { data: row };
    }
    return { data: row };
  });
  const service = createBulkPayoutService(client);
  await service.create('merchant-1', { asset:'SOL', items:[{recipient:'wallet-1',amount:'1'}] }, 'create-key-1');
  await service.submit('merchant-1', 'batch-1', 'signature-1');
  const mutationCalls=calls.filter(call=>call.method==='POST');
  assert.equal(mutationCalls[0].headers.get('Idempotency-Key'), 'create-key-1');
  assert.equal(mutationCalls[1].headers.get('Idempotency-Key'), 'batch-1');
});


test('Bulk Pay Base58 encoder preserves leading zero bytes without duplication', () => {
  assert.equal(encodeBase58(new Uint8Array()), '');
  assert.equal(encodeBase58(new Uint8Array([0])), '1');
  assert.equal(encodeBase58(new Uint8Array([0, 0, 1])), '112');
  assert.equal(encodeBase58(new Uint8Array([1, 2, 3])), 'Ldp');
});
