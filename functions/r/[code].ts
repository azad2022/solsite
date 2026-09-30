import {
  enforceReferralClickRateLimit,
  recordReferralClick,
  referralCookieHeader,
  type ReferralServiceEnv,
} from '../api/pay/_shared/referralAttribution';

interface Env extends ReferralServiceEnv {
  PAY_API_ENABLED?: string;
}

const CODE = /^[a-z0-9_]{4,120}$/i;

export const onRequestGet = async ({ request, env, params }: {
  request: Request;
  env: Env;
  params: { code?: string };
}) => {
  const code = String(params?.code || '').trim().toLowerCase();
  if (env.PAY_API_ENABLED !== 'true' || !CODE.test(code)) {
    return new Response('Referral link not found.', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'CDN-Cache-Control': 'no-store',
      },
    });
  }

  try {
    await enforceReferralClickRateLimit(env, request);
    const click = await recordReferralClick(env, code);
    const requestUrl = new URL(request.url);
    const location = new URL('/', requestUrl.origin);
    return new Response(null, {
      status: 302,
      headers: {
        Location: location.toString(),
        'Set-Cookie': referralCookieHeader(click, requestUrl.protocol === 'https:'),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'CDN-Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'REFERRAL_RATE_LIMITED') {
      return new Response('Too many referral clicks. Please try again later.', {
        status: 429,
        headers: {
          'Retry-After': '60',
          'Cache-Control': 'no-store',
          'CDN-Cache-Control': 'no-store',
        },
      });
    }

    if (error instanceof Error && error.message === 'REFERRAL_NOT_FOUND') {
      return new Response('Referral link not found.', {
        status: 404,
        headers: {
          'Cache-Control': 'no-store',
          'CDN-Cache-Control': 'no-store',
        },
      });
    }

    console.error(JSON.stringify({
      scope: 'pay:referral-click',
      error: error instanceof Error ? error.message : 'unknown',
    }));

    return new Response('Referral service is temporarily unavailable.', {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'CDN-Cache-Control': 'no-store',
      },
    });
  }
};
