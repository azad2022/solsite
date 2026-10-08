import { makePayRequestId, payFeatureEnabled, payJson, PayRuntimeError } from '../../../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../../../_shared/identity';

interface Env extends PayIdentityEnv { PAY_API_ENABLED?: string; }
function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
const selectBatch = 'id,merchant_id,created_by_user_id,asset,token_mint,token_program,token_decimals,source_wallet_address,total_amount_atomic,item_count,status,transaction_signature,transaction_slot,transaction_block_time,failure_code,failure_reason,verification_commitment,verification_summary,created_at,updated_at';

export const onRequestGet = async ({ request, env, params }: { request: Request; env: Env; params: { id?: string } }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code:'PAY_API_DISABLED',message:'Pay API is not enabled.' },404,requestId);
  const batchId = String(params?.id || '').trim();
  if (!validUuid(batchId)) return payJson({ code:'PAYOUT_BATCH_ID_INVALID',message:'Payout batch ID is invalid.' },400,requestId);

  try {
    const identity = await resolvePayIdentity(request, env);
    const merchantId = new URL(request.url).searchParams.get('merchantId')?.trim() || '';
    if (!validUuid(merchantId)) return payJson({ code:'MERCHANT_ID_INVALID',message:'Merchant ID is invalid.' },400,requestId);
    const accessResponse = await supabaseRequestAsIdentity(env, identity.accessToken, '/rest/v1/rpc/pay_has_merchant_access', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({p_merchant_id:merchantId,p_roles:['owner','admin','finance','developer','viewer']}),
    });
    if ((await accessResponse.json()) !== true) return payJson({ code:'FORBIDDEN',message:'You do not have access to this merchant.' },403,requestId);
    const batchResponse = await supabaseRequestAsIdentity(env, identity.accessToken,
      '/rest/v1/pay_payout_batches?select=' + selectBatch + '&id=eq.' + encodeURIComponent(batchId) + '&merchant_id=eq.' + encodeURIComponent(merchantId) + '&limit=1',
    );
    const batches = await batchResponse.json() as unknown[];
    if (!batches[0]) return payJson({ code:'PAYOUT_BATCH_NOT_FOUND',message:'Payout batch was not found.' },404,requestId);
    const itemsResponse = await supabaseRequestAsIdentity(env, identity.accessToken,
      '/rest/v1/pay_payout_items?select=id,batch_id,line_number,recipient,amount_atomic,status,failure_code,failure_reason,created_at,updated_at&batch_id=eq.' + encodeURIComponent(batchId) + '&order=line_number.asc&limit=50',
    );
    const items = await itemsResponse.json();
    return payJson({ apiVersion:'v1', data:{ batch:batches[0], items } },200,requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code:error.code,message:error.message },error.status,requestId);
    console.error(JSON.stringify({scope:'pay:payout-batch:detail',requestId,batchId,error:error instanceof Error?error.message:'unknown'}));
    return payJson({ code:'PAYOUT_BATCH_DETAIL_FAILED',message:'Bulk Pay batch could not be loaded.' },503,requestId);
  }
};