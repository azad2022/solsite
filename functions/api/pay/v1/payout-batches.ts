import { PublicKey } from '@solana/web3.js';
import {
  assertIdempotencyKey, enforcePayRateLimit, hashCanonicalRequest, makePayRequestId, payFeatureEnabled, payJson, readJsonBody, PayRuntimeError,
} from '../../../_shared/runtime';
import { resolveAssetFromEnvironment, type SupportedAssetConfig } from '../../../../../src/pay/services/assetPolicy';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../../../_shared/identity';
import type { PaymentAsset } from '../../../../../src/pay/types/domain';

interface PayoutEnv extends PayIdentityEnv {
  PAY_USDC_MINT?: string;
  PAY_USDT_MINT?: string;
  PAY_USDC_DECIMALS?: string;
  PAY_USDT_DECIMALS?: string;
}

type PayoutItemInput = { recipient: string; amountAtomic: string };

function uuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{3}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function asset(value: unknown): value is PaymentAsset {
  return value === 'SOL' || value === 'USDC' || value === 'USDT';
}
function parseItems(value: unknown): PayoutItemInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) throw new PayRuntimeError('INVALID_ITEMS',400,'Bulk Pay requires between 1 and 50 payout items.');
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new PayRuntimeError('INVALID_ITEM',400,'Payout item ' + (index + 1) + ' is invalid.');
    const row = item as Record<string, unknown>;
    const recipient = typeof row.recipient === 'string' ? row.recipient.trim() : '';
    const amountAtomic = typeof row.amountAtomic === 'string' ? row.amountAtomic.trim() : '';
    if (!recipient || !amountAtomic || amountAtomic.length > 78 || !/^[0-9]+$/.test(amountAtomic) || BigInt(amountAtomic) <= 0n) throw new PayRuntimeError('INVALID_ITEM',400,'Payout item ' + (index + 1) + ' is invalid.');
    try { new PublicKey(recipient); } catch { throw new PayRuntimeError('INVALID_RECIPIENT',400,'Payout recipient ' + (index + 1) + ' is not a valid Solana address.'); }
    return { recipient, amountAtomic };
  });
}
function mapRpcState(state: string | undefined): { code:string; message:string; status:number } | null {
  switch (state) {
    case 'unauthorized': return { code:'UNAUTHORIZED',message:'A valid SolMint session is required.',status:401 };
    case 'forbidden': return { code:'FORBIDDEN',message:'You do not have permission to operate Bulk Pay for this merchant.',status:403 };
    case 'invalid': return { code:'INVALID_REQUEST',message:'Bulk Pay request is invalid.',status:400 };
    case 'conflict': return { code:'IDEMPOTENCY_CONFLICT',message:'The idempotency key was already used with different request data.',status:409 };
    case 'in_progress': return { code:'REQUEST_IN_PROGRESS',message:'The same Bulk Pay request is already being processed.',status:409 };
    case 'wallet_not_ready': return { code:'MERCHANT_WALLET_NOT_READY',message:'A single active verified receiving wallet is required before Bulk Pay can be used.',status:409 };
    case 'merchant_not_active': return { code:'MERCHANT_NOT_ACTIVE',message:'The merchant is not active.',status:409 };
    default: return null;
  }
}
async function rpc<T>(env: PayoutEnv, token: string, name: string, body: Record<string, unknown>): Promise<T> {
  const response = await supabaseRequestAsIdentity(env, token, '/rest/v1/rpc/' + name, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  return await response.json() as T;
}
function publicAsset(config: SupportedAssetConfig) { return { asset:config.asset, decimals:config.decimals }; }

export const onRequestGet = async ({ request, env }: { request: Request; env: PayoutEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code:'PAY_API_DISABLED',message:'Pay API is not enabled.' },404,requestId);
  try {
    const identity = await resolvePayIdentity(request, env);
    const url = new URL(request.url);
    if (url.searchParams.get('assets') === '1') {
      const configs = (['SOL','USDC','USDT'] as const).map(a => resolveAssetFromEnvironment(a, env));
      return payJson({ apiVersion:'v1', data:{ assets:configs.map(publicAsset) } },200,requestId);
    }
    const merchantId = url.searchParams.get('merchantId')?.trim() || '';
    if (!uuid(merchantId)) return payJson({ code:'MERCHANT_ID_INVALID',message:'Merchant ID is invalid.' },400,requestId);
    const rawLimit = Number(url.searchParams.get('limit') || '50');
    const limit = Math.min(100, Math.max(1, rawLimit));
    if (!Number.isInteger(rawLimit)) return payJson({ code:'LIMIT_INVALID',message:'Limit is invalid.' },400,requestId);
    const access = await rpc<boolean>(env, identity.accessToken,'pay_has_merchant_access',{ p_merchant_id:merchantId,p_roles:['owner','admin','finance','developer','viewer'] });
    if (access !== true) return payJson({ code:'FORBIDDEN',message:'You do not have access to this merchant.' },403,requestId);
    const response = await supabaseRequestAsIdentity(env, identity.accessToken,
      '/rest/v1/pay_payout_batches?select=id,merchant_id,created_by_user_id,asset,token_mint,token_program,token_decimals,source_wallet_address,total_amount_atomic,item_count,status,transaction_signature,transaction_slot,transaction_block_time,failure_code,failure_reason,verification_commitment,verification_summary,created_at,updated_at&merchant_id=eq.' + encodeURIComponent(merchantId) + '&order=created_at.desc&limit=' + limit,
    );
    return payJson({ apiVersion:'v1', data:{ batches:await response.json() } },200,requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code:error.code,message:error.message },error.status,requestId);
    console.error(JSON.stringify({scope:'pay:payout-batches:list',requestId,error:error instanceof Error?error.message:'unknown'}));
    return payJson({ code:'PAYOUT_BATCH_LIST_FAILED',message:'Bulk Pay history could not be loaded.' },503,requestId);
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: PayoutEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code:'PAY_API_DISABLED',message:'Pay API is not enabled.' },404,requestId);
  try {
    const identity = await resolvePayIdentity(request, env);
    const body = await readJsonBody(request);
    const merchantId = typeof body.merchantId === 'string' ? body.merchantId.trim() : '';
    if (!uuid(merchantId)) return payJson({ code:'MERCHANT_ID_INVALID',message:'Merchant ID is invalid.' },400,requestId);
    if (!asset(body.asset)) return payJson({ code:'INVALID_ASSET',message:'Unsupported payout asset.' },400,requestId);
    const items = parseItems(body.items);
    const idempotencyKey = await assertIdempotencyKey(request);
    const canonical = { merchantId, asset:body.asset, items };
    const requestHash = await hashCanonicalRequest(canonical);
    const subjectHash = await hashCanonicalRequest({ userId:identity.user.applicationUserId,merchantId });
    await enforcePayRateLimit(env,'payout-batches:create',subjectHash,60,10);
    const config = resolveAssetFromEnvironment(body.asset, env);
    const result = await rpc<any>(env, identity.accessToken,'pay_create_payout_batch',{
      p_merchant_id:merchantId,p_asset:config.asset,p_token_mint:config.tokenMint,p_token_program:config.tokenProgram,p_token_decimals:config.decimals,
      p_items:items,p_idempotency_key:idempotencyKey,p_request_hash:requestHash,
    });
    const mapped = mapRpcState(result?.state);
    if (mapped) return payJson({ code:mapped.code,message:mapped.message },mapped.status,requestId);
    if (result?.state === 'created' || result?.state === 'replay') {
      return payJson(result.response_body || { code:'PAYOUT_BATCH_RESPONSE_INVALID',message:'Invalid payout batch response.' }, result.response_status || (result.state === 'created' ? 201 : 200), requestId);
    }
    return payJson({ code:'PAYOUT_BATCH_CREATE_FAILED',message:'Bulk Pay batch could not be created.' },503,requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code:error.code,message:error.message },error.status,requestId);
    console.error(JSON.stringify({scope:'pay:payout-batches:create',requestId,error:error instanceof Error?error.message:'unknown'}));
    return payJson({ code:'PAYOUT_BATCH_CREATE_FAILED',message:'Bulk Pay batch could not be created safely.' },503,requestId);
  }
};
