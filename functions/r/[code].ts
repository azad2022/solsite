import {
  recordReferralClick,
  referralCookieHeader,
  type ReferralServiceEnv,
} from '../api/pay/_shared/referralAttribution';

interface Env extends ReferralServiceEnv {
  PAY_API_ENABLED?: string;
}

const CODE = /^sm_[0-9a-f]{12}$/i;

function homeRedirect(request: Request): Response {
  const requestUrl = new URL(request.url);
  const location = new URL('/', requestUrl.origin);
  return new Response(null, {
    status: 302,
    headers: {
      Location: location.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'CDN-Cache-Control': 'no-store',
    },
  });
}


export const onRequestGet = async ({ request, env, params }: {
  request: Request;
  env: Env;
  params: { code?: string };
}) => {
  const code = String(params?.code || '').trim().toLowerCase();
  if (env.PAY_API_ENABLED !== 'true' || !CODE.test(code)) {
    return homeRedirect(request);
  }

  try {
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
    if (error instanceof Error && error.message === 'REFERRAL_NOT_FOUND') {
      return homeRedirect(request);
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
