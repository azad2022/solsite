import { PayRuntimeError, type PayRuntimeEnv } from './runtime';

const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';

type ReservationResult = {
  state: 'reserved' | 'replay' | 'conflict' | 'in_progress';
  resourceId?: string | null;
  responseStatus?: number;
  responseBody?: unknown;
};

function baseUrl(env: PayRuntimeEnv): string {
  return (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
}

function secret(env: PayRuntimeEnv): string {
  return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
}

async function requestJson<T>(env: PayRuntimeEnv, path: string, init: RequestInit): Promise<T> {
  const key = secret(env);
  if (!key) throw new PayRuntimeError('SERVER_MISCONFIGURED', 503, 'Pay backend is not configured.');
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  if (!env.SUPABASE_SECRET_KEY && env.SUPABASE_SERVICE_ROLE_KEY) headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  const response = await fetch(`${baseUrl(env)}${path}`, { ...init, headers });
  if (!response.ok) throw new PayRuntimeError('UPSTREAM_DATABASE_ERROR', 503, 'Pay data service is unavailable.');
  return await response.json() as T;
}

export async function reserveIdempotencyAtomically(
  env: PayRuntimeEnv,
  merchantId: string,
  scope: string,
  idempotencyKey: string,
  requestHash: string,
): Promise<ReservationResult> {
  const result = await requestJson<ReservationResult[]>(env, '/rest/v1/rpc/pay_reserve_idempotency', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      p_merchant_id: merchantId,
      p_scope: scope,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
    }),
  });
  // PostgREST returns a scalar JSON value for scalar RPCs and an array only
  // when the function is table-returning. Handle both without weakening the
  // fail-closed behavior.
  const value = (result as unknown as ReservationResult) ?? (Array.isArray(result) ? result[0] : null);
  if (!value || typeof value !== 'object' || !value.state) throw new PayRuntimeError('IDEMPOTENCY_UNAVAILABLE', 503, 'Unable to reserve request safely.');
  return value;
}

export async function failIdempotency(
  env: PayRuntimeEnv,
  merchantId: string,
  scope: string,
  idempotencyKey: string,
): Promise<void> {
  const key = secret(env);
  if (!key) throw new PayRuntimeError('SERVER_MISCONFIGURED', 503, 'Pay backend is not configured.');
  const headers = new Headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal', apikey: key });
  if (!env.SUPABASE_SECRET_KEY && env.SUPABASE_SERVICE_ROLE_KEY) headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  const response = await fetch(
    `${baseUrl(env)}/rest/v1/pay_idempotency_keys?merchant_id=eq.${encodeURIComponent(merchantId)}&scope=eq.${encodeURIComponent(scope)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`,
    { method: 'PATCH', headers, body: JSON.stringify({ status: 'failed' }) },
  );
  if (!response.ok) console.error(JSON.stringify({ scope: 'pay:idempotency', operation: 'mark_failed', status: response.status }));
}
