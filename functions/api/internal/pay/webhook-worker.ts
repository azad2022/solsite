import { decryptWebhookSecret } from '../../../../src/pay/services/webhookSecretEnvelope';
import { fetchWebhookWithTimeout, WEBHOOK_MAX_ATTEMPTS } from '../../../../src/pay/services/webhookDelivery';
import { signWebhookPayload } from '../../../../src/pay/services/webhookSigner';
import { makePayRequestId, PayRuntimeError, payJson, readJsonBody, supabaseRequest, enforcePayRateLimit } from '../../pay/_shared/runtime';

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAY_WEBHOOK_MASTER_KEY_B64URL?: string;
  PAY_WEBHOOK_WORKER_SECRET?: string;
}

interface ClaimedDelivery {
  id: string;
  webhook_id: string;
  event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  endpoint_url: string;
  secret_ciphertext: string | null;
  secret_key_version: string | null;
  attempt_count: number;
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  const max = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < max; i += 1) diff |= (left[i % Math.max(left.length, 1)] ?? 0) ^ (right[i % Math.max(right.length, 1)] ?? 0);
  return diff === 0;
}

function authorized(request: Request, env: Env): boolean {
  const configured = env.PAY_WEBHOOK_WORKER_SECRET?.trim();
  if (!configured || configured.length < 32) return false;
  const header = request.headers.get('Authorization') || '';
  return /^Bearer\s+/i.test(header) && constantTimeEqual(header.replace(/^Bearer\s+/i, '').trim(), configured);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function claim(env: Env, workerId: string, limit: number): Promise<ClaimedDelivery[]> {
  const response = await supabaseRequest(env, '/rest/v1/rpc/pay_claim_webhook_deliveries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ p_worker_id: workerId, p_limit: limit, p_lease_seconds: 60 }),
  });
  return await response.json() as ClaimedDelivery[];
}

async function complete(env: Env, deliveryId: string, workerId: string, status: number, responseHash: string): Promise<void> {
  const response = await supabaseRequest(env, '/rest/v1/rpc/pay_complete_webhook_delivery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ p_delivery_id: deliveryId, p_worker_id: workerId, p_response_status: status, p_response_hash: responseHash }),
  });
  const result = await response.json() as { ok?: boolean };
  if (result.ok !== true) throw new PayRuntimeError('STALE_DELIVERY_LEASE', 503, 'Webhook delivery lease is stale.');
}

async function fail(env: Env, deliveryId: string, workerId: string, errorCode: string, status: number | null, responseHash: string | null): Promise<{ status: string; attemptCount: number }> {
  const response = await supabaseRequest(env, '/rest/v1/rpc/pay_fail_webhook_delivery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ p_delivery_id: deliveryId, p_worker_id: workerId, p_error_code: errorCode, p_response_status: status, p_response_hash: responseHash, p_max_attempts: WEBHOOK_MAX_ATTEMPTS }),
  });
  const result = await response.json() as { ok?: boolean; status?: string; attemptCount?: number };
  if (result.ok !== true || !result.status || !Number.isInteger(result.attemptCount)) throw new PayRuntimeError('STALE_DELIVERY_LEASE', 503, 'Webhook delivery lease is stale.');
  return { status: result.status, attemptCount: result.attemptCount };
}

async function masterSecret(env: Env, ciphertext: string): Promise<string> {
  if (!env.PAY_WEBHOOK_MASTER_KEY_B64URL) throw new Error('Webhook master key is not configured.');
  return decryptWebhookSecret({ envelope: ciphertext, masterKeyBase64Url: env.PAY_WEBHOOK_MASTER_KEY_B64URL });
}

async function processDelivery(env: Env, workerId: string, delivery: ClaimedDelivery): Promise<{ status: string; attemptCount: number; deadLetter: boolean }> {
  if (!delivery.secret_ciphertext) {
    const result = await fail(env, delivery.id, workerId, 'WEBHOOK_SECRET_UNAVAILABLE', null, null);
    return { ...result, deadLetter: result.status === 'dead_letter' };
  }

  const rawBody = JSON.stringify(delivery.payload);
  let signatureHeader: string;
  try {
    const secret = await masterSecret(env, delivery.secret_ciphertext);
    signatureHeader = await signWebhookPayload({
      webhookId: delivery.webhook_id,
      eventId: delivery.event_id,
      timestampSeconds: Math.floor(Date.now() / 1000),
      rawBody,
      keyVersion: delivery.secret_key_version,
      secretProvider: { getSigningSecret: async () => secret },
    });
  } catch {
    const result = await fail(env, delivery.id, workerId, 'WEBHOOK_SECRET_DECRYPT_FAILED', null, null);
    return { ...result, deadLetter: result.status === 'dead_letter' };
  }

  try {
    const response = await fetchWebhookWithTimeout({ endpointUrl: delivery.endpoint_url, signatureHeader, body: rawBody });
    const responseHash = await sha256Hex(`${response.status}`);
    if (response.ok) {
      await complete(env, delivery.id, workerId, response.status, responseHash);
      return { status: 'delivered', attemptCount: delivery.attempt_count + 1, deadLetter: false };
    }
    const result = await fail(env, delivery.id, workerId, `HTTP_${response.status}`, response.status, responseHash);
    return { ...result, deadLetter: result.status === 'dead_letter' };
  } catch (error) {
    const code = error instanceof DOMException && error.name === 'AbortError' ? 'WEBHOOK_TIMEOUT' : 'WEBHOOK_NETWORK_ERROR';
    const result = await fail(env, delivery.id, workerId, code, null, null);
    return { ...result, deadLetter: result.status === 'dead_letter' };
  }
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const requestId = makePayRequestId();
  try {
    if (!authorized(request, env)) return payJson({ code: 'UNAUTHORIZED' }, 401, requestId);
    const body = await readJsonBody(request);
    const requested = body.limit === undefined ? 20 : Number(body.limit);
    if (!Number.isInteger(requested) || requested < 1 || requested > 100) throw new PayRuntimeError('INVALID_BATCH_SIZE', 400, 'limit must be an integer between 1 and 100.');
    const subjectBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pay-webhook-worker'));
    const subjectHash = Array.from(new Uint8Array(subjectBytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
    await enforcePayRateLimit(env, 'webhook:worker', subjectHash, 60, 30);

    const workerId = requestId;
    const deliveries = await claim(env, workerId, requested);
    const results = [];
    for (const delivery of deliveries) results.push({ id: delivery.id, ...(await processDelivery(env, workerId, delivery)) });
    return payJson({ data: { claimed: deliveries.length, results } }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Webhook worker is temporarily unavailable.' : error.message }, error.status, requestId);
    console.error(JSON.stringify({ scope: 'pay:webhook-worker', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'INTERNAL_ERROR', message: 'Webhook worker is temporarily unavailable.' }, 503, requestId);
  }
};
