import { getAuthenticatedUser, type AuthUser } from '../../auth/_shared';
import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson, readJsonBody, supabaseRequest } from '../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../_shared/identity';

interface PayEnv extends PayIdentityEnv { PAY_API_ENABLED?: string; PAY_APP_ORIGIN?: string; SUPABASE_URL?: string; SUPABASE_SECRET_KEY?: string; SUPABASE_SERVICE_ROLE_KEY?: string; }
interface TicketRow { id: string; merchant_id: string; created_by_user_id: string; subject: string; status: string; priority: string; created_at: string; updated_at: string; closed_at: string | null; }
const ticketSelect = 'id,merchant_id,created_by_user_id,subject,status,priority,created_at,updated_at,closed_at';

function originAllowed(request: Request, env: PayEnv): boolean { const expected = env.PAY_APP_ORIGIN?.trim(); return !!expected && request.headers.get('Origin') === expected; }
function mapTicket(row: TicketRow) { return { id: row.id, merchantId: row.merchant_id, createdByUserId: row.created_by_user_id, subject: row.subject, status: row.status, priority: row.priority, createdAt: row.created_at, updatedAt: row.updated_at, closedAt: row.closed_at }; }
function isAdmin(user: AuthUser | null): boolean { return !!user && user.is_active !== false && user.role === 'admin'; }
function validUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function validPriority(value: unknown): value is 'normal'|'high'|'urgent' { return value === 'normal' || value === 'high' || value === 'urgent'; }

export const onRequestGet = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    const identity = await resolvePayIdentity(request, env);
    const userIsAdmin = identity.user.role === 'admin';
    const url = new URL(request.url);
    const merchantId = url.searchParams.get('merchantId')?.trim() || '';
    const status = url.searchParams.get('status')?.trim() || '';
    if (!userIsAdmin && !validUuid(merchantId)) return payJson({ code: 'INVALID_MERCHANT_ID', message: 'A valid merchantId is required.' }, 400, requestId);
    if (status && !['open','pending_customer','pending_admin','resolved','closed'].includes(status)) return payJson({ code: 'INVALID_STATUS', message: 'Ticket status is invalid.' }, 400, requestId);

    const params = new URLSearchParams(); params.set('select', ticketSelect); params.set('order', 'updated_at.desc'); params.set('limit', '100');
    if (userIsAdmin) { if (merchantId) params.set('merchant_id', `eq.${merchantId}`); }
    else params.set('merchant_id', `eq.${merchantId}`);
    if (status) params.set('status', `eq.${status}`);
    const response = await supabaseRequestAsIdentity(env, identity.accessToken, `/rest/v1/pay_tickets?${params.toString()}`);
    const rows = await response.json() as TicketRow[];
    return payJson({ tickets: rows.map(mapTicket) }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:tickets:list', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'TICKET_LIST_FAILED', message: 'Unable to load support tickets.' }, 503, requestId);
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    if (!originAllowed(request, env)) return payJson({ code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not trusted.' }, 403, requestId);
    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false) return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, requestId);
    const body = await readJsonBody(request);
    const merchantId = typeof body.merchantId === 'string' ? body.merchantId.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const priority = body.priority === undefined ? 'normal' : body.priority;
    if (!validUuid(merchantId)) return payJson({ code: 'INVALID_MERCHANT_ID', message: 'merchantId is invalid.' }, 400, requestId);
    if (subject.length < 3 || subject.length > 160) return payJson({ code: 'INVALID_SUBJECT', message: 'subject must be between 3 and 160 characters.' }, 400, requestId);
    if (message.length < 1 || message.length > 10000) return payJson({ code: 'INVALID_MESSAGE', message: 'message must be between 1 and 10000 characters.' }, 400, requestId);
    if (!validPriority(priority)) return payJson({ code: 'INVALID_PRIORITY', message: 'priority is invalid.' }, 400, requestId);

    const response = await supabaseRequest(env, '/rest/v1/rpc/pay_create_ticket', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ p_user_id: user.id, p_merchant_id: merchantId, p_subject: subject, p_body: message, p_priority: priority }) });
    const ticket = await response.json() as TicketRow;
    return payJson({ ticket: mapTicket(ticket) }, 201, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) {
      if (error.code === 'UPSTREAM_DATABASE_ERROR') return payJson({ code: 'TICKET_CREATE_FAILED', message: 'Ticket could not be created safely.' }, 503, requestId);
      return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    }
    console.error(JSON.stringify({ scope: 'pay:tickets:create', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'TICKET_CREATE_FAILED', message: 'Unable to create support ticket.' }, 503, requestId);
  }
};
