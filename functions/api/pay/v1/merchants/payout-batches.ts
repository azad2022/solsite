import { PublicKey } from '@solana/web3.js';
import {
  assertIdempotencyKey,
  enforcePayRateLimit,
  hashCanonicalRequest,
  makePayRequestId,
  payFeatureEnabled,
  payJson,
  readJsonBody,
  PayRuntimeError,
} from '../../_shared/runtime';
import { resolveAssetFromEnvironment } from '../../../../../src/pay/services/assetPolicy';
import { canonicalizePayoutItems, parseDisplayAmountAtomic, PAYOUT_MAX_ITEMS } from '../../../../../src/pay/services/payoutPolicy';
import { assertTrustedOrigin, loadPayoutDetail, serializePayoutDetail, type BulkPayEnv } from '../../_shared/bulkPayout';
import { resolvePayIdentity, supabaseRequestAsIdentity } from '../../_shared/identity';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseLimit(value:string|null):number{
  if(value===null||value==='')return 50;
  const n=Number(value);
  if(!Number.isInteger(n)||n<1||n>100)throw new PayRuntimeError('INVALID_LIMIT',400,'Limit must be between 1 and 100.');
  return n;
}

function mapResult(result:Record<string,unknown>, requestId:string):Response{
  const state=String(result.state||'error');
  if(state==='created')return payJson(result.response_body||{},Number(result.response_status)||201,requestId);
  if(state==='replay')return payJson(result.response_body||{},200,requestId);
  if(state==='in_progress')return payJson({code:'REQUEST_IN_PROGRESS',message:'An identical payout batch request is already being processed.'},409,requestId);
  if(state==='conflict')return payJson({code:'IDEMPOTENCY_CONFLICT',message:'The Idempotency-Key was reused with different payout data.'},409,requestId);
  if(state==='forbidden')return payJson({code:'FORBIDDEN',message:'You are not allowed to create payout batches for this merchant.'},403,requestId);
  if(state==='merchant_not_active')return payJson({code:'MERCHANT_NOT_ACTIVE',message:'Merchant is not active.'},403,requestId);
  if(state==='wallet_not_ready')return payJson({code:'WALLET_NOT_READY',message:'A single active verified receiving wallet is required before creating a payout batch.'},409,requestId);
  if(state==='invalid')return payJson({code:'INVALID_PAYOUT_BATCH_INPUT',message:'Payout batch data is invalid.'},400,requestId);
  return payJson({code:'PAYOUT_BATCH_CREATION_FAILED',message:'Payout batch could not be created safely.'},503,requestId);
}

export const onRequestGet=async({request,env}:{request:Request;env:BulkPayEnv})=>{
  const requestId=makePayRequestId();
  if(!payFeatureEnabled(env))return payJson({code:'PAY_API_DISABLED',message:'Pay API is not enabled.'},404,requestId);
  try{
    const identity=await resolvePayIdentity(request,env);
    const params=new URL(request.url).searchParams;
    const merchantId=(params.get('merchantId')||'').trim();
    const batchId=(params.get('batchId')||'').trim();
    const limit=parseLimit(params.get('limit'));
    if(!UUID.test(merchantId))return payJson({code:'MERCHANT_ID_INVALID',message:'Merchant ID is invalid.'},400,requestId);
    if(batchId){
      if(!UUID.test(batchId))return payJson({code:'PAYOUT_BATCH_ID_INVALID',message:'Payout batch ID is invalid.'},400,requestId);
      const detail=await loadPayoutDetail(env,identity.accessToken,merchantId,batchId);
      if(!detail)return payJson({code:'PAYOUT_BATCH_NOT_FOUND',message:'Payout batch was not found.'},404,requestId);
      return payJson({apiVersion:'v1',data:serializePayoutDetail(detail)},200,requestId);
    }
    const response=await supabaseRequestAsIdentity(
      env,
      identity.accessToken,
      '/rest/v1/pay_payout_batches?select=id,merchant_id,created_by_user_id,asset,token_mint,token_program,token_decimals,source_wallet_address,total_amount_atomic::text,item_count,status,transaction_signature,transaction_slot,transaction_block_time,failure_code,failure_reason,verification_commitment,verification_summary,created_at,updated_at'
        +'&merchant_id=eq.'+encodeURIComponent(merchantId)
        +'&order=created_at.desc&limit='+String(limit),
    );
    const rows=await response.json() as Array<Record<string,unknown>>;
    return payJson({apiVersion:'v1',data:rows.map(row=>({
      id:row.id,merchantId:row.merchant_id,asset:row.asset,tokenMint:row.token_mint,tokenProgram:row.token_program,tokenDecimals:row.token_decimals,
      sourceWalletAddress:row.source_wallet_address,totalAmountAtomic:String(row.total_amount_atomic),itemCount:row.item_count,status:row.status,
      transactionSignature:row.transaction_signature,transactionSlot:row.transaction_slot,transactionBlockTime:row.transaction_block_time,
      failureCode:row.failure_code,failureReason:row.failure_reason,verificationCommitment:row.verification_commitment,createdAt:row.created_at,updatedAt:row.updated_at,
    })),meta:{merchantId,limit,returned:rows.length}},200,requestId);
  }catch(error){
    if(error instanceof PayRuntimeError)return payJson({code:error.code,message:error.status>=500?'Pay service is temporarily unavailable.':error.message},error.status,requestId);
    console.error(JSON.stringify({scope:'pay:payout-batches-read',requestId,error:error instanceof Error?error.message.slice(0,300):'unknown'}));
    return payJson({code:'PAYOUT_BATCH_READ_FAILED',message:'Payout batch data could not be loaded.'},503,requestId);
  }
};

export const onRequestPost=async({request,env}:{request:Request;env:BulkPayEnv})=>{
  const requestId=makePayRequestId();
  if(!payFeatureEnabled(env))return payJson({code:'PAY_API_DISABLED',message:'Pay API is not enabled.'},404,requestId);
  try{
    assertTrustedOrigin(request,env);
    const identity=await resolvePayIdentity(request,env);
    const merchantId=(new URL(request.url).searchParams.get('merchantId')||'').trim();
    if(!UUID.test(merchantId))return payJson({code:'MERCHANT_ID_INVALID',message:'Merchant ID is invalid.'},400,requestId);

    const body=await readJsonBody(request);
    const asset=body.asset;
    if(asset!=='SOL'&&asset!=='USDC'&&asset!=='USDT')return payJson({code:'INVALID_PAYOUT_BATCH_INPUT',message:'Payout asset is invalid.'},400,requestId);
    const rawItems=Array.isArray(body.items)?body.items:[];
    if(rawItems.length<1||rawItems.length>PAYOUT_MAX_ITEMS)return payJson({code:'INVALID_ITEM_COUNT',message:'A payout batch must contain between 1 and 50 recipients.'},400,requestId);
    const config=resolveAssetFromEnvironment(asset,env as Record<string,string|undefined>);
    const decimals=config.decimals??9;
    const items=canonicalizePayoutItems(rawItems.map((item)=>{
      if(!item||typeof item!=='object')throw new Error('INVALID_ITEM');
      const row=item as Record<string,unknown>;
      const recipient=typeof row.recipient==='string'?row.recipient.trim():'';
      if(!recipient)new Error('INVALID_RECIPIENT');
      let canonicalRecipient:string;
      try{canonicalRecipient=new PublicKey(recipient).toBase58();}catch{throw new Error('INVALID_RECIPIENT');}
      const amountAtomic=parseDisplayAmountAtomic(row.amount,decimals);
      return {recipient:canonicalRecipient,amountAtomic};
    }));
    const normalized={
      merchantId,
      asset,
      tokenMint:config.tokenMint,
      tokenProgram:config.tokenProgram,
      tokenDecimals:config.decimals,
      items,
    };
    const idempotencyKey=await assertIdempotencyKey(request);
    const requestHash=await hashCanonicalRequest(normalized);
    const subjectHash=await hashCanonicalRequest({userId:identity.user.applicationUserId});
    await enforcePayRateLimit(env,'payout-batches:create:user',subjectHash,60,30);
    const response=await supabaseRequestAsIdentity(
      env,
      identity.accessToken,
      '/rest/v1/rpc/pay_create_payout_batch',
      {method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({
        p_merchant_id:merchantId,p_asset:asset,p_token_mint:config.tokenMint,p_token_program:config.tokenProgram,p_token_decimals:config.decimals,
        p_items:items,p_idempotency_key:idempotencyKey,p_request_hash:requestHash,
      })},
    );
    const result=await response.json() as Record<string,unknown>;
    return mapResult(result,requestId);
  }catch(error){
    if(error instanceof PayRuntimeError)return payJson({code:error.code,message:error.status>=500?'Pay service is temporarily unavailable.':error.message},error.status,requestId);
    if(error instanceof Error){
      const code=error.message;
      const mapped:Record<string,[string,string,number]>={
        INVALID_ITEM:['INVALID_PAYOUT_BATCH_INPUT','Payout item is invalid.',400],
        INVALID_RECIPIENT:['INVALID_RECIPIENT','A valid Solana recipient address is required.',400],
        INVALID_AMOUNT:['INVALID_AMOUNT','Payout amount is invalid.',400],
        TOO_MANY_DECIMALS:['TOO_MANY_DECIMALS','Payout amount has too many decimal places for the selected asset.',400],
        TOKEN_POLICY_UNSUPPORTED:['ASSET_NOT_SUPPORTED','The selected token policy is not supported.',422],
      };
      if(mapped[code])return payJson({code:mapped[code][0],message:mapped[code][1]},mapped[code][2],requestId);
    }
    console.error(JSON.stringify({scope:'pay:payout-batch-create',requestId,error:error instanceof Error?error.message.slice(0,300):'unknown'}));
    return payJson({code:'PAYOUT_BATCH_CREATION_FAILED',message:'Payout batch could not be created.'},503,requestId);
  }
};
