import { getBetterAuthFoundationConfig } from '../auth/_foundation';
import { createBetterAuthRuntime } from '../auth/_instance';
import type { Env } from '../auth/_shared';
import { jsonResponse } from '../auth/_shared';

interface SessionManagementEnv extends Env {
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
}

function isTrustedStateChangingOrigin(request: Request, env: SessionManagementEnv): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    const { trustedOrigins } = getBetterAuthFoundationConfig(env);
    return trustedOrigins.includes(new URL(origin).origin);
  } catch {
    return false;
  }
}

function safeSession(session: any, currentSessionId: string | null) {
  return {
    id: String(session?.id || ''),
    current: String(session?.id || '') === currentSessionId,
    expiresAt: session?.expiresAt ? new Date(session.expiresAt).toISOString() : null,
    createdAt: session?.createdAt ? new Date(session.createdAt).toISOString() : null,
    updatedAt: session?.updatedAt ? new Date(session.updatedAt).toISOString() : null,
    ipAddress: session?.ipAddress ? String(session.ipAddress) : null,
    userAgent: session?.userAgent ? String(session.userAgent).slice(0, 512) : null,
  };
}

export const onRequestGet = async ({ request, env }: { request: Request; env: SessionManagementEnv }) => {
  const runtime = createBetterAuthRuntime(env);
  try {
    const session = await runtime.auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id || !session.session?.id) {
      return jsonResponse({ success: false, code: 'AUTH_REQUIRED', message: 'نشست کاربری معتبر نیست.' }, 401);
    }

    const sessions = await runtime.auth.api.listSessions({ headers: request.headers });
    const currentSessionId = String(session.session.id);
    const safeSessions = (Array.isArray(sessions) ? sessions : [])
      .map((item) => safeSession(item, currentSessionId))
      .filter((item) => item.id && item.expiresAt && Date.parse(item.expiresAt) > Date.now());

    return jsonResponse({ success: true, sessions: safeSessions }, 200, {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    });
  } catch (error) {
    console.error('Session list error:', error instanceof Error ? error.message : String(error));
    return jsonResponse({ success: false, code: 'SESSION_LIST_FAILED', message: 'دریافت نشست‌های فعال ناموفق بود.' }, 503);
  } finally {
    await runtime.close();
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: SessionManagementEnv }) => {
  if (!isTrustedStateChangingOrigin(request, env)) {
    return jsonResponse({ success: false, code: 'CSRF_ORIGIN_REJECTED', message: 'مبدأ درخواست برای این عملیات مجاز نیست.' }, 403);
  }

  const runtime = createBetterAuthRuntime(env);
  try {
    const session = await runtime.auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id || !session.session?.id) {
      return jsonResponse({ success: false, code: 'AUTH_REQUIRED', message: 'نشست کاربری معتبر نیست.' }, 401);
    }

    let body: { sessionId?: unknown };
    try {
      body = (await request.json()) as { sessionId?: unknown };
    } catch {
      return jsonResponse({ success: false, code: 'SESSION_BODY_INVALID', message: 'بدنه درخواست معتبر نیست.' }, 400);
    }

    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!sessionId || sessionId.length > 256) {
      return jsonResponse({ success: false, code: 'SESSION_ID_INVALID', message: 'شناسه نشست معتبر نیست.' }, 400);
    }

    const sessionToken = await runtime.application.findBetterAuthSessionToken(sessionId, String(session.user.id));
    if (!sessionToken) {
      return jsonResponse({ success: false, code: 'SESSION_NOT_FOUND', message: 'نشست مورد نظر یافت نشد.' }, 404);
    }

    if (sessionId === String(session.session.id)) {
      await runtime.auth.api.signOut({ headers: request.headers });
      return jsonResponse({ success: true, revoked: true, current: true });
    }

    await runtime.auth.api.revokeSession({
      body: { token: sessionToken },
      headers: request.headers,
    });

    return jsonResponse({ success: true, revoked: true, current: false });
  } catch (error) {
    console.error('Session revoke error:', error instanceof Error ? error.message : String(error));
    return jsonResponse({ success: false, code: 'SESSION_REVOKE_FAILED', message: 'لغو نشست ناموفق بود.' }, 503);
  } finally {
    await runtime.close();
  }
};
