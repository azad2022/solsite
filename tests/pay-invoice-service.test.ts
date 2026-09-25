import assert from 'node:assert/strict';
import test from 'node:test';
import { createPayInvoiceService } from '../src/pay/services/invoiceService';
import type { PayHttpClient } from '../src/pay/http';

const merchantId='11111111-1111-4111-8111-111111111111';
const invoiceId='22222222-2222-4222-8222-222222222222';
const invoice={id:invoiceId,merchant_id:merchantId,invoice_number:'INV-1001',customer_label:'Customer A',title:'Website payment',description:'Test invoice',amount_atomic:'1250000',asset:'USDC',fee_payer:'merchant',checkout_locale:'en-US',due_at:null,status:'open',created_at:'2026-09-18T00:00:00Z',updated_at:'2026-09-18T00:00:00Z'};
function clientFor(payload:unknown,capture?:(path:string,init:RequestInit)=>void):PayHttpClient{return{request:async<T>(path:string,init:RequestInit={})=>{capture?.(path,init);return payload as T;}} as unknown as PayHttpClient;}

test('invoice service parses the released read envelope',async()=>{
 const result=await createPayInvoiceService(clientFor({success:true,apiVersion:'v1',data:[invoice]})).list(merchantId);
 assert.equal(result[0]?.invoice_number,'INV-1001'); assert.equal(result[0]?.amount_atomic,'1250000');
});
test('invoice service rejects malformed financial data',async()=>{
 await assert.rejects(()=>createPayInvoiceService(clientFor({success:true,apiVersion:'v1',data:[{...invoice,amount_atomic:'12.5'}]})).list(merchantId),/Invalid Pay invoice field: amount_atomic/);
});
test('invoice service validates filters and identifiers',async()=>{
 const s=createPayInvoiceService(clientFor({success:true,apiVersion:'v1',data:[]}));
 await assert.rejects(()=>s.list('not-a-uuid'),/Merchant ID is invalid/);
 await assert.rejects(()=>s.list(merchantId,{status:'bad' as never}),/Invoice status is invalid/);
});
test('invoice service parses the detail envelope',async()=>{
 const result=await createPayInvoiceService(clientFor({success:true,apiVersion:'v1',data:invoice})).get(merchantId,invoiceId);
 assert.equal(result.id,invoiceId); assert.equal(result.status,'open');
});
test('invoice service creates through same-origin API with Idempotency-Key',async()=>{
 let path=''; let init:RequestInit|undefined;
 const result=await createPayInvoiceService(clientFor({success:true,apiVersion:'v1',data:invoice},(p,i)=>{path=p;init=i})).create({
   merchantId,invoiceNumber:'INV-1001',customerLabel:'Customer A',title:'Website payment',description:null,
   amountAtomic:'1250000',asset:'USDC',feePayer:'merchant',checkoutLocale:'en-US',dueAt:null
 },'invoice-idempotency-test');
 assert.equal(result.id,invoiceId); assert.equal(path,'/api/pay/v1/invoices'); assert.equal(init?.method,'POST');
 assert.equal(new Headers(init?.headers).get('Idempotency-Key'),'invoice-idempotency-test');
});
