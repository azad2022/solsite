import { getAuthenticatedUser } from '../../../../auth/_shared';
import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson, readJsonBody, supabaseRequest } from '../../../_shared/runtime';

type PayEnv = {
  PAY_API_ENABLED?: string;
  PAY_APP_ORIGIN?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};
interface MessageRow { id: string; ticket_id: string; author_user_id: string; body: string; created_at: string; }

function originAllowed(request: Request, env: PayEnv): boolean { const expected = env.PAY_APP_ORIGIN?.trim(); return !!expected && request.headers.get('Origin') === expected; }
function validUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function mapMessage(row: MessageRow) { return { id: row.id, ticketId: row.ticket_id, authorUserId: row.author_user_id, body: row.body, createdAt: row.created_at }; }

export const onRequestPost = async ({ request, env, params }: { request: Request; env: PayEnv; params: Record<string, string | undefined> }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    if (!originAllowed(request, env)) return payJson({ code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not trusted.' }, 403, requestId);
    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false) return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, requestId);
    const ticketId = params.ticketId || '';
    if (!validUuid(ticketId)) return payJson({ code: 'INVALID_TICKET_ID', message: 'ticketId is invalid.' }, 400, requestId);
    const body = await readJsonBody(request);
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (message.length < 1 || message.length > 10000) return payJson({ code: 'INVALID_MESSAGE', message: 'message must be between 1 and 10000 characters.' }, 400, requestId);
    const response = await supabaseRequest(env, '/rest/v1/rpc/pay_add_ticket_message', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ p_user_id: user.id, p_ticket_id: ticketId, p_body: message }) });
    const created = await response.json() as MessageRow;
    return payJson({ message: mapMessage(created) }, 201, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:tickets:message', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'TICKET_MESSAGE_FAILED', message: 'Unable to send ticket message.' }, 503, requestId);
  }
};
