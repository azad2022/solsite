import { PayRuntimeError, assertIdempotencyKey, enforcePayRateLimit, hashCanonicalRequest, makePayRequestId, payFeatureEnabled, payJson, readJsonBody } from '../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../_shared/identity';

interface PayEnv extends PayIdentityEnv { PAY_API_ENABLED?: string; PAY_APP_ORIGIN?: string; }

const STATUSES = new Set(['draft', 'open', 'paid', 'partially_paid', 'overdue', 'void', 'refunded']);
const FEE_PAYERS = new Set(['merchant', 'customer']);
const LOCALES = new Set(['fa-IR', 'en-US', 'ar', 'ru', 'auto']);
const ASSETS = new Set(['SOL', 'USDC', 'USDT']);
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
export const onRequestPost = async ({ request, env }: { request: Request; env: PayEnv }) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);
  try {
    if (!env.PAY_APP_ORIGIN?.trim() || request.headers.get('Origin') !== env.PAY_APP_ORIGIN.trim()) {
      return payJson({ code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not trusted.' }, 403, requestId);
    }
    const identity = await resolvePayIdentity(request, env);
    const subjectHash = await hashCanonicalRequest({ userId: identity.user.applicationUserId });
    await enforcePayRateLimit(env, 'invoices:create:user', subjectHash, 60, 30);

    const idempotencyKey = await assertIdempotencyKey(request);
    const body = await readJsonBody(request);
    const merchantId = typeof body.merchantId === 'string' ? body.merchantId.trim() : '';
    const invoiceNumber = typeof body.invoiceNumber === 'string' ? body.invoiceNumber.trim() : '';
    const customerLabel = typeof body.customerLabel === 'string' ? body.customerLabel.trim() : null;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : null;
    const amountAtomic = body.amountAtomic;
    const asset = body.asset;
    const feePayer = body.feePayer === undefined ? 'merchant' : body.feePayer;
    const checkoutLocale = body.checkoutLocale === undefined ? 'auto' : body.checkoutLocale;
    const rawDueAt = body.dueAt ?? null;

    if (!validUuid(merchantId)) return payJson({ code: 'MERCHANT_ID_INVALID', message: 'Merchant ID is invalid.' }, 400, requestId);
    if (!invoiceNumber || invoiceNumber.length > 120) return payJson({ code: 'INVALID_INVOICE_INPUT', message: 'Invoice number is invalid.' }, 400, requestId);
    if (!title || title.length > 200) return payJson({ code: 'INVALID_INVOICE_INPUT', message: 'Invoice title is invalid.' }, 400, requestId);
    if (customerLabel !== null && customerLabel.length > 160) return payJson({ code: 'INVALID_INVOICE_INPUT', message: 'Customer label is too long.' }, 400, requestId);
    if (description !== null && description.length > 5000) return payJson({ code: 'INVALID_INVOICE_INPUT', message: 'Description is too long.' }, 400, requestId);
    if (typeof amountAtomic !== 'string' || !/^\d{1,78}$/.test(amountAtomic) || BigInt(amountAtomic) <= 0n) return payJson({ code: 'INVALID_INVOICE_AMOUNT', message: 'amountAtomic must be a positive integer string.' }, 400, requestId);
    if (typeof asset !== 'string' || !ASSETS.has(asset)) return payJson({ code: 'INVALID_INVOICE_INPUT', message: 'Asset is invalid.' }, 400, requestId);
    if (typeof feePayer !== 'string' || !FEE_PAYERS.has(feePayer)) return payJson({ code: 'INVALID_INVOICE_INPUT', message: 'Fee payer is invalid.' }, 400, requestId);
    if (typeof checkoutLocale !== 'string' || !LOCALES.has(checkoutLocale)) return payJson({ code: 'INVALID_INVOICE_INPUT', message: 'Checkout locale is invalid.' }, 400, requestId);

    let dueAt: string | null = null;
    if (rawDueAt !== null && rawDueAt !== '') {
      if (typeof rawDueAt !== 'string' || Number.isNaN(Date.parse(rawDueAt))) return payJson({ code: 'INVALID_INVOICE_DUE_AT', message: 'dueAt must be a valid timestamp or null.' }, 400, requestId);
      dueAt = new Date(rawDueAt).toISOString();
    }

    const canonical = { merchantId, invoiceNumber, customerLabel, title, description, amountAtomic, asset, feePayer, checkoutLocale, dueAt };
    const requestHash = await hashCanonicalRequest(canonical);
    const response = await supabaseRequestAsIdentity(env, identity.accessToken, '/rest/v1/rpc/pay_create_invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_merchant_id: merchantId,
        p_invoice_number: invoiceNumber,
        p_customer_label: customerLabel,
        p_title: title,
        p_description: description,
        p_amount_atomic: amountAtomic,
        p_asset: asset,
        p_fee_payer: feePayer,
        p_checkout_locale: checkoutLocale,
        p_due_at: dueAt,
        p_idempotency_key: idempotencyKey,
        p_request_hash: requestHash,
      }),
    });

    const result = await response.json() as { state?: string; response_status?: number; response_body?: unknown };
    if (result.state === 'created') return payJson(result.response_body || {}, result.response_status || 201, requestId);
    if (result.state === 'replay') return payJson(result.response_body || {}, 200, requestId);
    if (result.state === 'in_progress') return payJson({ code: 'REQUEST_IN_PROGRESS', message: 'An identical invoice request is already being processed.' }, 409, requestId);
    if (result.state === 'conflict') return payJson({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency-Key was reused with different invoice data.' }, 409, requestId);
    if (result.state === 'duplicate_invoice') return payJson({ code: 'INVOICE_NUMBER_EXISTS', message: 'This invoice number already exists for the merchant.' }, 409, requestId);
    if (result.state === 'forbidden') return payJson({ code: 'FORBIDDEN', message: 'You are not allowed to create invoices for this merchant.' }, 403, requestId);
    if (result.state === 'merchant_not_active') return payJson({ code: 'MERCHANT_NOT_ACTIVE', message: 'Merchant is not active.' }, 403, requestId);
    if (result.state === 'unauthorized') return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, requestId);
    if (result.state === 'invalid') return payJson({ code: 'INVALID_INVOICE_INPUT', message: 'Invoice data is invalid.' }, 400, requestId);
    throw new PayRuntimeError('INVOICE_CREATION_FAILED', 503, 'Invoice could not be created safely.');
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:invoice-create', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'INTERNAL_ERROR', message: 'Pay service is temporarily unavailable.' }, 503, requestId);
  }
};
