import { getAuthenticatedUser, jsonResponse } from '../../../auth/_shared';
import { PayRuntimeError, payFeatureEnabled, supabaseRequest } from '../_shared/runtime';

interface PayEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAY_API_ENABLED?: string;
}

function requestId(): string { return `PAY-${crypto.randomUUID()}`; }

export const onRequestPost = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const id = requestId();
  if (!payFeatureEnabled(env)) return jsonResponse({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.', requestId: id }, 404);

  try {
    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false) return jsonResponse({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.', requestId: id }, 401);

    const existingResponse = await supabaseRequest(env, `/rest/v1/pay_merchants?select=id,owner_user_id,status,created_at,updated_at&owner_user_id=eq.${encodeURIComponent(user.id)}&limit=1`, { headers: { Accept: 'application/json' } });
    const existing = await existingResponse.json() as Array<{ id: string; owner_user_id: string; status: string; created_at: string; updated_at: string }>;
    if (existing[0]) return jsonResponse({ merchant: existing[0], created: false, requestId: id }, 200);

    const createResponse = await supabaseRequest(env, '/rest/v1/pay_merchants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ owner_user_id: user.id, status: 'pending' }),
    });
    const rows = await createResponse.json() as Array<{ id: string; owner_user_id: string; status: string; created_at: string; updated_at: string }>;
    const merchant = rows[0];
    if (!merchant) throw new PayRuntimeError('MERCHANT_CREATION_FAILED', 503, 'Merchant could not be created safely.');

    return jsonResponse({ merchant, created: true, requestId: id }, 201);
  } catch (error) {
    if (error instanceof PayRuntimeError) return jsonResponse({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message, requestId: id }, error.status);
    console.error(JSON.stringify({ scope: 'pay:merchant-create', requestId: id, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return jsonResponse({ code: 'INTERNAL_ERROR', message: 'Pay service is temporarily unavailable.', requestId: id }, 503);
  }
};

export const onRequestGet = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const id = requestId();
  if (!payFeatureEnabled(env)) return jsonResponse({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.', requestId: id }, 404);
  try {
    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false) return jsonResponse({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.', requestId: id }, 401);
    const response = await supabaseRequest(env, `/rest/v1/pay_merchants?select=id,owner_user_id,status,created_at,updated_at&owner_user_id=eq.${encodeURIComponent(user.id)}&limit=1`, { headers: { Accept: 'application/json' } });
    const rows = await response.json() as Array<{ id: string; owner_user_id: string; status: string; created_at: string; updated_at: string }>;
    return jsonResponse({ merchant: rows[0] || null, requestId: id }, 200);
  } catch {
    return jsonResponse({ code: 'MERCHANT_LOOKUP_FAILED', message: 'Unable to load merchant configuration.', requestId: id }, 503);
  }
};
