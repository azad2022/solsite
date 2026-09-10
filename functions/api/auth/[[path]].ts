import { createBetterAuthRuntime, type SolmintBetterAuthRuntimeEnv } from './_instance';

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
      return await runtime.auth.handler(request);
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
