import { getAuthenticatedUser } from '../../../auth/_shared';
import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson, readJsonBody, supabaseRequest } from '../../_shared/runtime';

interface PayEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAY_API_ENABLED?: string;
  PAY_APP_ORIGIN?: string;
}

interface MerchantRow {
  id: string;
  owner_user_id: string;
  business_name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function originAllowed(request: Request, env: PayEnv): boolean {
  const expected = env.PAY_APP_ORIGIN?.trim();
  return !!expected && request.headers.get('Origin') === expected;
}

function validBusinessName(value: string): boolean {
  return value.length >= 2 && value.length <= 120;
}

function validSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{2,59}$/.test(value);
}

async function loadMerchant(env: PayEnv, userId: string): Promise<MerchantRow | null> {
  const response = await supabaseRequest(env, `/rest/v1/pay_merchants?select=id,owner_user_id,business_name,slug,status,created_at,updated_at&owner_user_id=eq.${encodeURIComponent(userId)}&limit=1`, { headers: { Accept: 'application/json' } });
  const rows = await response.json() as MerchantRow[];
  return rows[0] || null;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const id = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, id);
  try {
    if (!originAllowed(request, env)) return payJson({ code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not trusted.' }, 403, id);

    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false) return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, id);

    const body = await readJsonBody(request);
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    if (!validBusinessName(businessName) || !validSlug(slug)) {
      return payJson({ code: 'INVALID_MERCHANT_INPUT', message: 'businessName or slug is invalid.' }, 400, id);
    }

    const existing = await loadMerchant(env, user.id);
    if (existing) return payJson({ merchant: existing, created: false }, 200, id);

    const createResponse = await supabaseRequest(env, '/rest/v1/rpc/pay_create_merchant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_owner_user_id: user.id, p_business_name: businessName, p_slug: slug }),
    });
    const merchant = await createResponse.json() as MerchantRow;
    if (!merchant?.id) throw new PayRuntimeError('MERCHANT_CREATION_FAILED', 503, 'Merchant could not be created safely.');

    return payJson({ merchant, created: true }, 201, id);
  } catch (error) {
    if (error instanceof PayRuntimeError) {
      if (error.code === 'UPSTREAM_DATABASE_ERROR') {
        const existing = await loadMerchant(env, (await getAuthenticatedUser(env, request))?.id || '').catch(() => null);
        if (existing) return payJson({ merchant: existing, created: false }, 200, id);
      }
      return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, id);
    }
    console.error(JSON.stringify({ scope: 'pay:merchant-create', requestId: id, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'INTERNAL_ERROR', message: 'Pay service is temporarily unavailable.' }, 503, id);
  }
};

export const onRequestGet = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const id = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, id);
  try {
    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false) return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, id);
    const merchant = await loadMerchant(env, user.id);
    return payJson({ merchant }, 200, id);
  } catch {
    return payJson({ code: 'MERCHANT_LOOKUP_FAILED', message: 'Unable to load merchant configuration.' }, 503, id);
  }
};
