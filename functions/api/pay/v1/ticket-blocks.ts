import { getAuthenticatedUser } from '../../auth/_shared';
import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson, readJsonBody, supabaseRequest } from '../_shared/runtime';
import { enforceTicketRateLimit, requireTicketJson } from '../_shared/ticketSecurity';

interface PayEnv {
  PAY_API_ENABLED?: string;
  PAY_APP_ORIGIN?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}
interface BlockRow { user_id: string; blocked_by_user_id: string; reason: string; blocked_at: string; }

function originAllowed(request: Request, env: PayEnv): boolean {
  const expected = env.PAY_APP_ORIGIN?.trim();
  return !!expected && request.headers.get('Origin') === expected;
}
function validUserId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,256}$/.test(value);
}
async function requireAdmin(request: Request, env: PayEnv) {
  const user = await getAuthenticatedUser(env, request);
  if (!user || user.is_active === false) return { response: payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401), user: null };
  if (user.role !== 'admin') return { response: payJson({ code: 'FORBIDDEN', message: 'Administrator access is required.' }, 403), user: null };
  return { response: null, user };
}
function errorResponse(error: unknown, scope: string, requestId: string) {
  if (error instanceof PayRuntimeError) return payJson(
    { code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message },
    error.status,
    requestId,
    error.code === 'RATE_LIMITED' ? { 'Retry-After': '60' } : {},
  );
  console.error(JSON.stringify({ scope, requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
  return payJson({ code: 'TICKET_BLOCK_LIST_FAILED', message: 'Unable to load or update blocked users.' }, 503, requestId);
}

export const onRequestGet = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;
    const admin = auth.user;
    if (!admin) return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, requestId);
    await enforceTicketRateLimit(env, request, admin.id, 'blocked-users-read', 60, 30, 60);
    const response = await supabaseRequest(env, '/rest/v1/pay_ticket_user_blocks?select=user_id,blocked_by_user_id,reason,blocked_at&order=blocked_at.desc&limit=200', { headers: { Accept: 'application/json' } });
    const rows = await response.json() as BlockRow[];
    return payJson({
      blockedUsers: rows.map(row => ({
        userId: row.user_id,
        blockedByUserId: row.blocked_by_user_id,
        reason: row.reason,
        blockedAt: row.blocked_at,
      })),
    }, 200, requestId);
  } catch (error) {
    return errorResponse(error, 'pay:tickets:blocked-users-list', requestId);
  }
};

export const onRequestDelete = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    if (!originAllowed(request, env)) return payJson({ code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not trusted.' }, 403, requestId);
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;
    const admin = auth.user;
    if (!admin) return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, requestId);
    await enforceTicketRateLimit(env, request, admin.id, 'blocked-users-mutation', 60, 10, 20);
    requireTicketJson(request);
    const body = await readJsonBody(request);
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (!validUserId(userId)) return payJson({ code: 'INVALID_USER_ID', message: 'A valid userId is required.' }, 400, requestId);
    const response = await supabaseRequest(env, '/rest/v1/rpc/pay_unblock_ticket_user_by_id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_admin_user_id: admin.id, p_target_user_id: userId }),
    });
    const changed = await response.json() as boolean;
    return payJson({ userId, isBlocked: false, changed }, 200, requestId);
  } catch (error) {
    return errorResponse(error, 'pay:tickets:blocked-user-unblock', requestId);
  }
};
