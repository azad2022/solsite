import { readReferralCookie } from '../pay/_shared/referralAttribution';
import {
  createBetterAuthRuntime,
  processReferralSignupFromRequest,
  type SolmintBetterAuthRuntimeEnv,
} from './_instance';

type PagesAuthContext = {
  request: Request;
  env: SolmintBetterAuthRuntimeEnv;
};

type AuthUnavailableCode =
  | 'AUTH_CONFIG_MISSING'
  | 'AUTH_GOOGLE_CONFIG'
  | 'AUTH_DATABASE_CONFIG'
  | 'AUTH_RUNTIME_INIT_FAILED'
  | 'AUTH_REQUEST_FAILED';

function classifyAuthError(error: unknown): AuthUnavailableCode {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('better_auth_secret') || message.includes('better auth secret') || message.includes('better_auth_url') || message.includes('trusted_origins')) {
    return 'AUTH_CONFIG_MISSING';
  }
  if (message.includes('google oauth')) {
    return 'AUTH_GOOGLE_CONFIG';
  }
  if (message.includes('supabase_url') || message.includes('supabase_secret_key') || message.includes('supabase_service_role_key') || message.includes('production auth database transport')) {
    return 'AUTH_DATABASE_CONFIG';
  }
  return 'AUTH_RUNTIME_INIT_FAILED';
}

function unavailableResponse(code: AuthUnavailableCode, requestId: string): Response {
  return new Response(JSON.stringify({
    success: false,
    error: 'AUTH_SERVICE_UNAVAILABLE',
    code,
    requestId,
  }), {
    status: 503,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Auth-Error-Code': code,
      'X-Request-Id': requestId,
    },
  });
}

export function isPasswordResetPath(pathname: string): boolean {
  return /^\/api\/auth\/reset-password\/[^/]+$/.test(pathname);
}

export function redirectLegacyPasswordReset(request: Request): Response | null {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  if (!isPasswordResetPath(url.pathname)) return null;

  const token = url.pathname.slice('/api/auth/reset-password/'.length);
  if (!token) return null;

  const destination = new URL('/auth/reset-password', url.origin);
  destination.searchParams.set('token', token);
  return Response.redirect(destination.toString(), 302);
}

export const onRequest = async ({ request, env }: PagesAuthContext): Promise<Response> => {
  const requestId = crypto.randomUUID();

  const legacyResetRedirect = redirectLegacyPasswordReset(request);
  if (legacyResetRedirect) return legacyResetRedirect;

  const pathname = new URL(request.url).pathname;
  const isNativeEmailSignup = request.method === 'POST' && pathname === '/api/auth/sign-up/email';
  const nativeReferralClick = isNativeEmailSignup ? readReferralCookie(request) : null;

  let runtime: ReturnType<typeof createBetterAuthRuntime> | null = null;

  try {
    try {
      runtime = createBetterAuthRuntime(env);
    } catch (error) {
      const code = classifyAuthError(error);
      console.error('Better Auth runtime initialization failed:', {
        requestId,
        code,
        message: error instanceof Error ? error.message : 'unknown error',
      });
      return unavailableResponse(code, requestId);
    }

    try {
      const response = await runtime.auth.handler(request);

      if (
        isNativeEmailSignup &&
        (response.status === 200 || response.status === 201)
      ) {
        try {
          const payload = await response.clone().json() as {
            user?: { id?: unknown; name?: unknown };
          };
          const betterAuthUserId = typeof payload?.user?.id === 'string'
            ? payload.user.id
            : '';
          if (betterAuthUserId) {
            await processReferralSignupFromRequest(
              env,
              runtime.application,
              nativeReferralClick,
              betterAuthUserId,
              typeof payload.user?.name === 'string'
                ? payload.user.name
                : 'کاربر جدید',
            );
          }

          if (request.headers.get('X-Solmint-Referral-Diagnostic') === '1') {
            const rawCookie = request.headers.get('Cookie') || '';
            const rawReferralCookiePresent = rawCookie
              .split(';')
              .some((part) => part.trim().startsWith('solmint_referral_click='));
            const diagnosticBody = {
              ...payload,
              _solmint_referral_diagnostic: {
                nativeEmailSignup: isNativeEmailSignup,
                responseStatusEligible: response.status === 200 || response.status === 201,
                rawReferralCookiePresent,
                parsedReferralClickPresent: Boolean(nativeReferralClick),
                betterAuthUserIdPresent: Boolean(betterAuthUserId),
              },
            };
            try {
              const headers = new Headers(response.headers);
              headers.set('Content-Type', 'application/json; charset=utf-8');
              return new Response(JSON.stringify(diagnosticBody), {
                status: response.status,
                statusText: response.statusText,
                headers,
              });
            } catch (error) {
              console.warn('Referral auth diagnostic response failed:', {
                requestId,
                message: error instanceof Error ? error.message : 'unknown error',
              });
            }
          }
        } catch (error) {
          console.warn('Referral signup boundary processing failed:', {
            requestId,
            message: error instanceof Error ? error.message : 'unknown error',
          });
        }
      }

      return response;
    } catch (error) {
      console.error('Better Auth request failed:', {
        requestId,
        message: error instanceof Error ? error.message : 'unknown error',
      });
      return unavailableResponse('AUTH_REQUEST_FAILED', requestId);
    }
  } finally {
    if (runtime) {
      await runtime.close().catch((error) => {
        console.warn('Better Auth runtime cleanup failed:', error instanceof Error ? error.message : 'unknown error');
      });
    }
  }
};
