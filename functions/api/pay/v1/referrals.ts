import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson } from '../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../_shared/identity';

interface PayEnv extends PayIdentityEnv { PAY_API_ENABLED?: string; }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AFFILIATE_SELECT = 'id,display_name,referral_code,commission_rate_bps,status,created_at,updated_at';
const REFERRAL_SELECT = 'id,affiliate_id,merchant_id,referral_code,attributed_at,active';
const COMMISSION_SELECT = 'id,referral_id,payment_id,gross_gateway_fee_atomic,commission_bps,commission_atomic,status,created_at,approved_at,paid_at';

function safeLimit(value: string | null): number {
  if (!value) return 100;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) throw new PayRuntimeError('INVALID_LIMIT', 400, 'Limit must be between 1 and 100.');
  return parsed;
}

export const onRequestGet = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);

  try {
    const identity = await resolvePayIdentity(request, env);
    const params = new URL(request.url).searchParams;
    const limit = safeLimit(params.get('limit'));

    const [affiliateResponse, referralResponse, commissionResponse] = await Promise.all([
      supabaseRequestAsIdentity(env, identity.accessToken, '/rest/v1/pay_affiliates?select=' + AFFILIATE_SELECT + '&order=created_at.desc&limit=' + limit),
      supabaseRequestAsIdentity(env, identity.accessToken, '/rest/v1/pay_referrals?select=' + REFERRAL_SELECT + '&order=attributed_at.desc&limit=' + limit),
      supabaseRequestAsIdentity(env, identity.accessToken, '/rest/v1/pay_commissions?select=' + COMMISSION_SELECT + '&order=created_at.desc&limit=' + limit),
    ]);

    const affiliates = await affiliateResponse.json() as Array<Record<string, unknown>>;
    const referrals = await referralResponse.json() as Array<Record<string, unknown>>;
    const commissions = await commissionResponse.json() as Array<Record<string, unknown>>;

    return payJson({
      apiVersion: 'v1',
      data: { affiliates, referrals, commissions },
      meta: {
        limit,
        returned: {
          affiliates: affiliates.length,
          referrals: referrals.length,
          commissions: commissions.length,
        },
      },
    }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) {
      return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    }
    console.error(JSON.stringify({ scope: 'pay:referrals-read', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'REFERRALS_READ_FAILED', message: 'Referral data could not be retrieved.' }, 503, requestId);
  }
};
