import { getAuthenticatedUser } from '../../../../../auth/_shared';
import { PayRuntimeError, assertIdempotencyKey, hashCanonicalRequest, makePayRequestId, payFeatureEnabled, payJson, readJsonBody, supabaseRequest } from '../../../../_shared/runtime';
import { API_KEY_SCOPE, apiKeyDisplayPrefix, createApiKeySecret, hashApiKeySecret } from '../../../../../../src/pay/services/apiKeyPolicy';

interface PayEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAY_API_ENABLED?: string;
  PAY_APP_ORIGIN?: string;
}

type ApiKeyRow = {
  id: string;
  merchant_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

function originAllowed(request: Request, env: PayEnv): boolean {
  const expected = env.PAY_APP_ORIGIN?.trim();
  return !!expected && request.headers.get('Origin') === expected;
}
function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function mapApiKey(row: ApiKeyRow) {
  const status = row.revoked_at ? 'revoked' : row.expires_at && Date.parse(row.expires_at) <= Date.now() ? 'expired' : 'active';
  return { id: row.id, merchantId: row.merchant_id, name: row.name, keyPrefix: row.key_prefix, scopes: row.scopes, status, expiresAt: row.expires_at, revokedAt: row.revoked_at, lastUsedAt: row.last_used_at, createdAt: row.created_at };
}
async function assertMerchantOwner(env: PayEnv, merchantId: string, userId: string, allowSuspended = false): Promise<void> {
  const response = await supabaseRequest(env, `/rest/v1/pay_merchants?select=id,owner_user_id,status&id=eq.${encodeURIComponent(merchantId)}&limit=1`, { headers: { Accept: 'application/json' } });
  const rows = await response.json() as Array<{ id: string; owner_user_id: string; status: string }>;
  const merchant = rows[0];
  if (!merchant || merchant.owner_user_id !== userId) throw new PayRuntimeError('FORBIDDEN', 403, 'You do not control this merchant account.');
  if (!allowSuspended && merchant.status !== 'active') throw new PayRuntimeError('MERCHANT_NOT_ACTIVE', 403, 'Merchant is not active.');
  if (allowSuspended && merchant.status === 'closed') throw new PayRuntimeError('MERCHANT_NOT_ACTIVE', 403, 'Merchant is closed.');
}

export const onRequestDelete = async ({ request, env, params }: { request: Request; env: PayEnv; params: { merchantId: string; keyId: string } }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    if (!originAllowed(request, env)) return payJson({ code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not trusted.' }, 403, requestId);
    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false) return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, requestId);
    const merchantId = String(params.merchantId || '').trim();
    const keyId = String(params.keyId || '').trim();
    if (!validUuid(merchantId) || !validUuid(keyId)) return payJson({ code: 'INVALID_IDENTIFIER', message: 'Merchant or API key id is invalid.' }, 400, requestId);
    await assertMerchantOwner(env, merchantId, user.id, true);
    const rpcResponse = await supabaseRequest(env, '/rest/v1/rpc/pay_revoke_api_key', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ p_actor_user_id: user.id, p_merchant_id: merchantId, p_key_id: keyId }) });
    const result = await rpcResponse.json() as { state?: string; reason?: string; apiKey?: ApiKeyRow };
    if (result.state === 'revoked' && result.apiKey) return payJson({ apiKey: mapApiKey(result.apiKey) }, 200, requestId);
    if (result.reason === 'API_KEY_NOT_FOUND') return payJson({ code: 'API_KEY_NOT_FOUND', message: 'API key was not found.' }, 404, requestId);
    if (result.reason === 'MERCHANT_FORBIDDEN') return payJson({ code: 'FORBIDDEN', message: 'You do not control this merchant account.' }, 403, requestId);
    throw new PayRuntimeError('API_KEY_REVOKE_FAILED', 503, 'API key could not be revoked safely.');
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:api-key-revoke', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'INTERNAL_ERROR', message: 'Pay service is temporarily unavailable.' }, 503, requestId);
  }
};

export const onRequestPost = async ({ request, env, params }: { request: Request; env: PayEnv; params: { merchantId: string; keyId: string } }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    if (!originAllowed(request, env)) return payJson({ code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not trusted.' }, 403, requestId);
    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false) return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, requestId);
    const merchantId = String(params.merchantId || '').trim();
    const keyId = String(params.keyId || '').trim();
    if (!validUuid(merchantId) || !validUuid(keyId)) return payJson({ code: 'INVALID_IDENTIFIER', message: 'Merchant or API key id is invalid.' }, 400, requestId);
    await assertMerchantOwner(env, merchantId, user.id);
    const idempotencyKey = await assertIdempotencyKey(request);
    const body = await readJsonBody(request);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 120) return payJson({ code: 'INVALID_API_KEY_NAME', message: 'API key name must be between 1 and 120 characters.' }, 400, requestId);
    const scopes = body.scopes === undefined ? [API_KEY_SCOPE] : body.scopes;
    if (!Array.isArray(scopes) || scopes.length !== 1 || scopes[0] !== API_KEY_SCOPE) return payJson({ code: 'INVALID_API_KEY_SCOPES', message: `Only the ${API_KEY_SCOPE} scope is currently available.` }, 400, requestId);
    const expiresAt = body.expiresAt === null || body.expiresAt === undefined ? null : typeof body.expiresAt === 'string' ? body.expiresAt.trim() : '';
    if (expiresAt !== null && (!expiresAt || Number.isNaN(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) return payJson({ code: 'INVALID_API_KEY_EXPIRY', message: 'expiresAt must be a valid future date or null.' }, 400, requestId);

    const requestHash = await hashCanonicalRequest({ keyId, name, scopes, expiresAt });
    const secret = createApiKeySecret();
    const keyHash = await hashApiKeySecret(secret);
    const keyPrefix = apiKeyDisplayPrefix(secret);
    const rpcResponse = await supabaseRequest(env, '/rest/v1/rpc/pay_rotate_api_key', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ p_actor_user_id: user.id, p_merchant_id: merchantId, p_key_id: keyId, p_name: name, p_key_prefix: keyPrefix, p_key_hash: keyHash, p_scopes: scopes, p_expires_at: expiresAt, p_idempotency_key: idempotencyKey, p_request_hash: requestHash }) });
    const result = await rpcResponse.json() as { state?: string; reason?: string; response_body?: Record<string, unknown> };
    if (result.state === 'created') return payJson({ ...(result.response_body || {}), secret }, 201, requestId);
    if (result.state === 'replay') return payJson({ ...(result.response_body || {}), secretAvailable: false }, 200, requestId);
    if (result.state === 'in_progress') return payJson({ code: 'REQUEST_IN_PROGRESS', message: 'An identical API key rotation is already being processed.' }, 409, requestId);
    if (result.state === 'conflict') return payJson({ code: result.reason === 'API_KEY_UNIQUE_CONFLICT' ? 'API_KEY_CONFLICT' : 'IDEMPOTENCY_CONFLICT', message: result.reason === 'API_KEY_UNIQUE_CONFLICT' ? 'API key rotation conflicted with another operation.' : 'The Idempotency-Key was reused with different request data.' }, 409, requestId);
    if (result.reason === 'API_KEY_NOT_FOUND') return payJson({ code: 'API_KEY_NOT_FOUND', message: 'API key was not found.' }, 404, requestId);
    if (result.reason === 'API_KEY_REVOKED') return payJson({ code: 'API_KEY_REVOKED', message: 'This API key is already revoked and cannot be rotated.' }, 409, requestId);
    if (result.reason === 'MERCHANT_FORBIDDEN') return payJson({ code: 'FORBIDDEN', message: 'You do not control this merchant account.' }, 403, requestId);
    throw new PayRuntimeError('API_KEY_ROTATE_FAILED', 503, 'API key could not be rotated safely.');
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:api-key-rotate', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'INTERNAL_ERROR', message: 'Pay service is temporarily unavailable.' }, 503, requestId);
  }
};
