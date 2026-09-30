import { enforcePayRateLimit } from '../api/pay/_shared/runtime';
import {
  recordReferralClick,
  referralCookieHeader,
  type ReferralServiceEnv,
} from '../api/pay/_shared/referralAttribution';

interface Env extends ReferralServiceEnv {
  PAY_API_ENABLED?: string;
}

const CODE = /^[a-z0-9_]{4,120}$/i;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

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
    const ip = request.headers.get('cf-connecting-ip')?.trim();
    if (ip) {
      const subjectHash = await sha256Hex(ip + '|' + code);
      try {
        await enforcePayRateLimit(env, 'referral-click', subjectHash, 60, 30);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Too many Pay API requests')) {
          const requestUrl = new URL(request.url);
          const location = new URL('/?auth=register', requestUrl.origin);
          return new Response(null, {
            status: 302,
            headers: {
              Location: location.toString(),
              'Cache-Control': 'no-store, no-cache, must-revalidate',
              'CDN-Cache-Control': 'no-store',
            },
          });
        }
        throw error;
      }
    }

    const click = await recordReferralClick(env, code);
    const requestUrl = new URL(request.url);
    const location = new URL('/?auth=register', requestUrl.origin);
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
