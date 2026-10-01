import {
  recordReferralClick,
  referralCookieHeader,
  type ReferralServiceEnv,
} from '../api/pay/_shared/referralAttribution';
import { enforcePayRateLimit, hashCanonicalRequest, type PayRuntimeEnv } from '../api/pay/_shared/runtime';

interface Env extends ReferralServiceEnv, PayRuntimeEnv {}

const CODE = /^sm_[0-9a-f]{12}$/i;

function notFoundResponse(): Response {
  return new Response('Referral link not found.', {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'CDN-Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function homeRedirect(request: Request, click: { clickId: string; referralCode: string }): Response {
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
}


export const onRequestGet = async ({ request, env, params }: {
  request: Request;
  env: Env;
  params: { code?: string };
}) => {
  const code = String(params?.code || '').trim().toLowerCase();
  if (env.PAY_API_ENABLED !== 'true' || !CODE.test(code)) {
    return notFoundResponse();
  }

  try {
    const sourceIp = request.headers.get('CF-Connecting-IP')?.trim() || 'unknown';
    const subjectHash = await hashCanonicalRequest({ sourceIp });
    await enforcePayRateLimit(env, 'referral_click', subjectHash, 60, 60);
    const click = await recordReferralClick(env, code);
    return homeRedirect(request, click);
  } catch (error) {
    if (error instanceof Error && error.message === 'REFERRAL_NOT_FOUND') {
      return notFoundResponse();
    }

    if (error instanceof Error && 'status' in error && Number((error as { status?: unknown }).status) === 429) {
      return new Response('Too many referral clicks. Please try again later.', {
        status: 429,
        headers: { 'Retry-After': '60', 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' },
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
