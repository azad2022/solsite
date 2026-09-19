import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson } from '../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../_shared/identity';

interface PayEnv extends PayIdentityEnv { PAY_API_ENABLED?: string; }

const STATUSES = new Set(['draft', 'open', 'paid', 'partially_paid', 'overdue', 'void', 'refunded']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVOICE_SELECT = [
  'id', 'merchant_id', 'invoice_number', 'customer_label', 'title', 'description',
  'amount_atomic', 'asset', 'fee_payer', 'checkout_locale', 'due_at', 'status',
  'created_at', 'updated_at',
].join(',');

function validUuid(value: string): boolean { return UUID.test(value); }

function safeLimit(value: string | null): number {
  if (!value) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) throw new PayRuntimeError('INVALID_LIMIT', 400, 'Limit must be between 1 and 100.');
  return parsed;
}

function safeSearch(value: string): string {
  if (value.length > 120) throw new PayRuntimeError('SEARCH_TOO_LONG', 400, 'Search text is too long.');
  return value.replace(/[%*,()]/g, '').trim();
}

export const onRequestGet = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);

  try {
    const identity = await resolvePayIdentity(request, env);
    const params = new URL(request.url).searchParams;
    const merchantId = (params.get('merchantId') || '').trim();
    const invoiceId = (params.get('invoiceId') || '').trim();
    const status = (params.get('status') || '').trim();
    const search = safeSearch((params.get('search') || '').trim());
    const limit = safeLimit(params.get('limit'));

    if (!validUuid(merchantId)) return payJson({ code: 'MERCHANT_ID_INVALID', message: 'Merchant ID is invalid.' }, 400, requestId);
    if (invoiceId && !validUuid(invoiceId)) return payJson({ code: 'INVOICE_ID_INVALID', message: 'Invoice ID is invalid.' }, 400, requestId);
    if (status && !STATUSES.has(status)) return payJson({ code: 'STATUS_INVALID', message: 'Invoice status is invalid.' }, 400, requestId);

    const conditions = ['merchant_id=eq.' + encodeURIComponent(merchantId)];
    if (invoiceId) conditions.push('id=eq.' + encodeURIComponent(invoiceId));
    if (status) conditions.push('status=eq.' + encodeURIComponent(status));
    if (search) {
      if (validUuid(search)) {
        conditions.push('or=(id.eq.' + encodeURIComponent(search) + ',invoice_number.ilike.*' + encodeURIComponent(search) + '*,title.ilike.*' + encodeURIComponent(search) + '*,customer_label.ilike.*' + encodeURIComponent(search) + '*)');
      } else {
        conditions.push('or=(invoice_number.ilike.*' + encodeURIComponent(search) + '*,title.ilike.*' + encodeURIComponent(search) + '*,customer_label.ilike.*' + encodeURIComponent(search) + '*)');
      }
    }

    const response = await supabaseRequestAsIdentity(
      env,
      identity.accessToken,
      '/rest/v1/pay_invoices?select=' + INVOICE_SELECT + '&' + conditions.join('&') + '&order=created_at.desc&limit=' + (invoiceId ? '1' : String(limit)),
    );
    const rows = await response.json() as Array<Record<string, unknown>>;

    if (invoiceId && rows.length === 0) return payJson({ code: 'INVOICE_NOT_FOUND', message: 'Invoice was not found.' }, 404, requestId);

    return payJson({
      apiVersion: 'v1',
      data: invoiceId ? rows[0] : rows,
      meta: invoiceId ? { merchantId, invoiceId } : { merchantId, limit, returned: rows.length },
    }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:invoices-read', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'INVOICES_READ_FAILED', message: 'Invoice data could not be retrieved.' }, 503, requestId);
  }
};