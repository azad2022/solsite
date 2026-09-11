import { getAuthenticatedUser, type AuthUser } from '../../../auth/_shared';
import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson, readJsonBody, supabaseRequest } from '../../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../../_shared/identity';

interface PayEnv extends PayIdentityEnv { PAY_API_ENABLED?: string; PAY_APP_ORIGIN?: string; SUPABASE_URL?: string; SUPABASE_SECRET_KEY?: string; SUPABASE_SERVICE_ROLE_KEY?: string; }
interface TicketRow { id: string; merchant_id: string; created_by_user_id: string; subject: string; status: string; priority: string; created_at: string; updated_at: string; closed_at: string | null; }
interface MessageRow { id: string; ticket_id: string; author_user_id: string; body: string; created_at: string; }
const ticketSelect = 'id,merchant_id,created_by_user_id,subject,status,priority,created_at,updated_at,closed_at';
const messageSelect = 'id,ticket_id,author_user_id,body,created_at';

function originAllowed(request: Request, env: PayEnv): boolean { const expected = env.PAY_APP_ORIGIN?.trim(); return !!expected && request.headers.get('Origin') === expected; }
function validUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function mapTicket(row: TicketRow) { return { id: row.id, merchantId: row.merchant_id, createdByUserId: row.created_by_user_id, subject: row.subject, status: row.status, priority: row.priority, createdAt: row.created_at, updatedAt: row.updated_at, closedAt: row.closed_at }; }
function mapMessage(row: MessageRow) { return { id: row.id, ticketId: row.ticket_id, authorUserId: row.author_user_id, body: row.body, createdAt: row.created_at }; }

export const onRequestGet = async ({ request, env, params }: { request: Request; env: PayEnv; params: Record<string, string | undefined> }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    const ticketId = params.ticketId || '';
    if (!validUuid(ticketId)) return payJson({ code: 'INVALID_TICKET_ID', message: 'ticketId is invalid.' }, 400, requestId);
    const identity = await resolvePayIdentity(request, env);
    const response = await supabaseRequestAsIdentity(env, identity.accessToken, `/rest/v1/pay_tickets?select=${ticketSelect}&id=eq.${encodeURIComponent(ticketId)}&limit=1`);
    const tickets = await response.json() as TicketRow[];
    const ticket = tickets[0];
    if (!ticket) return payJson({ code: 'TICKET_NOT_FOUND', message: 'Ticket not found.' }, 404, requestId);
    const messagesResponse = await supabaseRequestAsIdentity(env, identity.accessToken, `/rest/v1/pay_ticket_messages?select=${messageSelect}&ticket_id=eq.${encodeURIComponent(ticketId)}&order=created_at.asc&limit=200`);
    const messages = await messagesResponse.json() as MessageRow[];
    return payJson({ ticket: mapTicket(ticket), messages: messages.map(mapMessage) }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:tickets:detail', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'TICKET_DETAIL_FAILED', message: 'Unable to load ticket.' }, 503, requestId);
  }
};

export const onRequestPatch = async ({ request, env, params }: { request: Request; env: PayEnv; params: Record<string, string | undefined> }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    if (!originAllowed(request, env)) return payJson({ code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not trusted.' }, 403, requestId);
    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false) return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, requestId);
    if (user.role !== 'admin') return payJson({ code: 'FORBIDDEN', message: 'Administrator access is required.' }, 403, requestId);
    const ticketId = params.ticketId || '';
    if (!validUuid(ticketId)) return payJson({ code: 'INVALID_TICKET_ID', message: 'ticketId is invalid.' }, 400, requestId);
    const body = await readJsonBody(request);
    const status = typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
    if (!['open','pending_customer','pending_admin','resolved','closed'].includes(status)) return payJson({ code: 'INVALID_STATUS', message: 'Ticket status is invalid.' }, 400, requestId);
    const response = await supabaseRequest(env, '/rest/v1/rpc/pay_update_ticket_status', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ p_user_id: user.id, p_ticket_id: ticketId, p_status: status }) });
    const ticket = await response.json() as TicketRow;
    return payJson({ ticket: mapTicket(ticket) }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:tickets:status', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'TICKET_STATUS_UPDATE_FAILED', message: 'Unable to update ticket status.' }, 503, requestId);
  }
};
