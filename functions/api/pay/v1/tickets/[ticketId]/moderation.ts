import { getAuthenticatedUser } from '../../../../auth/_shared';
import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson, readJsonBody, supabaseRequest } from '../../../_shared/runtime';
import { enforceTicketRateLimit, requireTicketJson } from '../../../_shared/ticketSecurity';

interface PayEnv {
  PAY_API_ENABLED?: string;
  PAY_APP_ORIGIN?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}
interface TicketTarget { id: string; merchant_id: string; created_by_user_id: string; }
interface BlockRow { user_id: string; blocked_by_user_id: string; reason: string; blocked_at: string; }
interface TargetUserRow { id: string; role: string; }

function originAllowed(request: Request, env: PayEnv): boolean {
  const expected = env.PAY_APP_ORIGIN?.trim();
  return !!expected && request.headers.get('Origin') === expected;
}
function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
async function requireAdmin(request: Request, env: PayEnv) {
  const user = await getAuthenticatedUser(env, request);
  if (!user || user.is_active === false) return { response: payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401), user: null };
  if (user.role !== 'admin') return { response: payJson({ code: 'FORBIDDEN', message: 'Administrator access is required.' }, 403), user: null };
  return { response: null, user };
}
async function getTicketTarget(env: PayEnv, ticketId: string): Promise<TicketTarget | null> {
  const response = await supabaseRequest(env, `/rest/v1/pay_tickets?select=id,merchant_id,created_by_user_id&id=eq.${encodeURIComponent(ticketId)}&deleted_at=is.null&limit=1`, { headers: { Accept: 'application/json' } });
  const rows = await response.json() as TicketTarget[];
  return rows[0] || null;
}
async function getBlockState(env: PayEnv, userId: string): Promise<BlockRow | null> {
  const response = await supabaseRequest(env, `/rest/v1/pay_ticket_user_blocks?select=user_id,blocked_by_user_id,reason,blocked_at&user_id=eq.${encodeURIComponent(userId)}&limit=1`, { headers: { Accept: 'application/json' } });
  const rows = await response.json() as BlockRow[];
  return rows[0] || null;
}
function errorResponse(error: unknown, scope: string, requestId: string) {
  if (error instanceof PayRuntimeError) return payJson(
    { code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message },
    error.status,
    requestId,
    error.code === 'RATE_LIMITED' ? { 'Retry-After': '60' } : {},
  );
  console.error(JSON.stringify({ scope, requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
  return payJson({ code: 'TICKET_MODERATION_FAILED', message: 'Unable to update ticket moderation.' }, 503, requestId);
}

export const onRequestGet = async ({ request, env, params }: { request: Request; env: PayEnv; params: Record<string, string | undefined> }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;
    const admin = auth.user;
    if (!admin) return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, requestId);
    await enforceTicketRateLimit(env, request, admin.id, 'moderation-read', 60, 60, 120);
    const ticketId = params.ticketId || '';
    if (!validUuid(ticketId)) return payJson({ code: 'INVALID_TICKET_ID', message: 'ticketId is invalid.' }, 400, requestId);
    const ticket = await getTicketTarget(env, ticketId);
    if (!ticket) return payJson({ code: 'TICKET_NOT_FOUND', message: 'Ticket not found.' }, 404, requestId);
    const block = await getBlockState(env, ticket.created_by_user_id);
    return payJson({ isBlocked: !!block, reason: block?.reason ?? null, blockedAt: block?.blocked_at ?? null }, 200, requestId);
  } catch (error) {
    return errorResponse(error, 'pay:tickets:moderation-read', requestId);
  }
};

export const onRequestPost = async ({ request, env, params }: { request: Request; env: PayEnv; params: Record<string, string | undefined> }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    if (!originAllowed(request, env)) return payJson({ code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not trusted.' }, 403, requestId);
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;
    const admin = auth.user;
    if (!admin) return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, requestId);
    await enforceTicketRateLimit(env, request, admin.id, 'moderation-write', 60, 10, 20);
    const ticketId = params.ticketId || '';
    if (!validUuid(ticketId)) return payJson({ code: 'INVALID_TICKET_ID', message: 'ticketId is invalid.' }, 400, requestId);
    requireTicketJson(request);
    const body = await readJsonBody(request);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 3 || reason.length > 500) return payJson({ code: 'INVALID_BLOCK_REASON', message: 'Block reason must be between 3 and 500 characters.' }, 400, requestId);
    const ticket = await getTicketTarget(env, ticketId);
    if (!ticket) return payJson({ code: 'TICKET_NOT_FOUND', message: 'Ticket not found.' }, 404, requestId);
    const targetResponse = await supabaseRequest(env, `/rest/v1/users?select=id,role&id=eq.${encodeURIComponent(ticket.created_by_user_id)}&limit=1`, { headers: { Accept: 'application/json' } });
    const targetRows = await targetResponse.json() as TargetUserRow[];
    if (ticket.created_by_user_id === admin.id || targetRows[0]?.role === 'admin') {
      return payJson({ code: 'ADMIN_USER_CANNOT_BE_BLOCKED', message: 'Administrator accounts cannot be blocked from Pay support.' }, 403, requestId);
    }
    const response = await supabaseRequest(env, '/rest/v1/rpc/pay_block_ticket_user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_admin_user_id: admin.id, p_ticket_id: ticketId, p_reason: reason }),
    });
    const block = await response.json() as BlockRow;
    return payJson({ isBlocked: true, reason: block.reason, blockedAt: block.blocked_at }, 200, requestId);
  } catch (error) {
    return errorResponse(error, 'pay:tickets:moderation-block', requestId);
  }
};

export const onRequestDelete = async ({ request, env, params }: { request: Request; env: PayEnv; params: Record<string, string | undefined> }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    if (!originAllowed(request, env)) return payJson({ code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not trusted.' }, 403, requestId);
    const auth = await requireAdmin(request, env);
    if (auth.response) return auth.response;
    const admin = auth.user;
    if (!admin) return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, requestId);
    await enforceTicketRateLimit(env, request, admin.id, 'moderation-write', 60, 10, 20);
    const ticketId = params.ticketId || '';
    if (!validUuid(ticketId)) return payJson({ code: 'INVALID_TICKET_ID', message: 'ticketId is invalid.' }, 400, requestId);
    const ticket = await getTicketTarget(env, ticketId);
    if (!ticket) return payJson({ code: 'TICKET_NOT_FOUND', message: 'Ticket not found.' }, 404, requestId);
    const response = await supabaseRequest(env, '/rest/v1/rpc/pay_unblock_ticket_user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_admin_user_id: admin.id, p_ticket_id: ticketId }),
    });
    const changed = await response.json() as boolean;
    return payJson({ isBlocked: false, reason: null, blockedAt: null, changed }, 200, requestId);
  } catch (error) {
    return errorResponse(error, 'pay:tickets:moderation-unblock', requestId);
  }
};
