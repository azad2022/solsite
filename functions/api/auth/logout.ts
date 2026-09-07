import { createBetterAuthRuntime } from './_instance';
import { clearSessionCookie, destroySession, jsonResponse, type Env } from './_shared';

type AuthEnv = Env & {
  NODE_ENV?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  BETTER_AUTH_DATABASE_URL?: string;
  HYPERDRIVE?: { connectionString: string };
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
};

export const onRequestPost = async ({ request, env }: { request: Request; env: AuthEnv }) => {
  const cookie = request.headers.get('Cookie') || '';
  const hasBetterAuthCookie = /(?:^|;\s*)(?:__Host-solmint_auth_session|solmint_auth_session)=/.test(cookie);
  let runtime: ReturnType<typeof createBetterAuthRuntime> | null = null;

  try {
    if (hasBetterAuthCookie) {
      runtime = createBetterAuthRuntime(env);
      await runtime.auth.api.signOut({ headers: request.headers });
    } else {
      await destroySession(env, request);
    }
  } catch (error) {
    console.error('Auth logout error:', error instanceof Error ? error.message : String(error));
  } finally {
    if (runtime && env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
      await runtime.database.end().catch(() => {});
    }
  }

  const headers: Record<string, string> = {
    'Set-Cookie': `${clearSessionCookie()}, __Host-solmint_auth_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`,
  };
  return jsonResponse({ success: true }, 200, headers);
};
