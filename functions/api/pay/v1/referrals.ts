import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson } from '../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../_shared/identity';
import { attributeReferralFromClick, readReferralCookie } from '../_shared/referralAttribution';

interface PayEnv extends PayIdentityEnv {
  PAY_API_ENABLED?: string;
}

function safeLimit(value: string | null): number {
  if (!value) return 100;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new PayRuntimeError('INVALID_LIMIT', 400, 'Limit must be between 1 and 100.');
  }
  return parsed;
}

export const onRequestGet = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) {
    return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  }

  try {
    const identity = await resolvePayIdentity(request, env);
    const params = new URL(request.url).searchParams;
    const limit = safeLimit(params.get('limit'));

    const referralClick = readReferralCookie(request);
    if (referralClick) {
      await attributeReferralFromClick(env, referralClick, identity.user.applicationUserId).catch((error) => {
        console.warn(JSON.stringify({
          scope: 'pay:referral-attribution-retry',
          requestId,
          reason: error instanceof Error ? error.message : 'unknown',
        }));
      });
    }

    const response = await supabaseRequestAsIdentity(
      env,
      identity.accessToken,
      '/rest/v1/rpc/pay_get_referral_dashboard',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ p_limit: limit }),
      },
    );

    const dashboard = await response.json() as {
      ok?: boolean;
      reason?: string;
      affiliate?: unknown;
      stats?: unknown;
      earnings_by_asset?: unknown;
      referrals?: unknown;
      commissions?: unknown;
    };

    if (dashboard.ok !== true) {
      if (dashboard.reason === 'AFFILIATE_NOT_FOUND') {
        return payJson({
          code: 'REFERRAL_NOT_CONFIGURED',
          message: 'Referral profile is not available for this account.',
        }, 404, requestId);
      }
      if (dashboard.reason === 'UNAUTHORIZED') {
        return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, requestId);
      }
      return payJson({ code: 'REFERRAL_DASHBOARD_UNAVAILABLE', message: 'Referral data could not be retrieved.' }, 503, requestId);
    }

    return payJson({
      apiVersion: 'v1',
      data: {
        affiliate: dashboard.affiliate,
        stats: dashboard.stats,
        earnings_by_asset: dashboard.earnings_by_asset,
        referrals: dashboard.referrals,
        commissions: dashboard.commissions,
      },
      meta: { limit },
    }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) {
      return payJson(
        { code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message },
        error.status,
        requestId,
      );
    }

    console.error(JSON.stringify({
      scope: 'pay:referrals-read',
      requestId,
      error: error instanceof Error ? error.message.slice(0, 300) : 'unknown',
    }));
    return payJson({ code: 'REFERRALS_READ_FAILED', message: 'Referral data could not be retrieved.' }, 503, requestId);
  }
};
