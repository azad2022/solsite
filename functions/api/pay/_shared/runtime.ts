import { calculateGatewayFee } from '../../../../src/pay/services/feePolicy';
import { validateApiKeyFormat, validateApiKeyRecord } from '../../../../src/pay/services/apiKeyPolicy';
import { validateIdempotencyKey, validatePublicMetadata } from '../../../../src/pay/services/securityPolicy';

export interface PayRuntimeEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAY_API_ENABLED?: string;
  PAY_FEE_RECIPIENT?: string;
  PAY_DEFAULT_EXPIRY_SECONDS?: string;
}

export interface PayApiPrincipal {
  merchantId: string;
  keyId: string;
  scopes: readonly string[];
}

export class PayRuntimeError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) {
    super(message);
    this.name = 'PayRuntimeError';
  }
}

const DEFAULT_SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const MAX_BODY_BYTES = 64 * 1024;
const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

export function makePayRequestId(): string {
  return `PAY-${crypto.randomUUID()}`;
}

export function payFeatureEnabled(env: PayRuntimeEnv): boolean {
  return env.PAY_API_ENABLED === 'true';
}

export function payJson(body: unknown, status = 200, requestId?: string): Response {
  return Response.json(
    { success: status < 400, ...(typeof body === 'object' && body !== null ? body : { data: body }), ...(requestId ? { requestId } : {}) },
    {
      status,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'CDN-Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
        ...(requestId ? { 'X-Pay-Request-ID': requestId } : {}),
      },
    },
  );
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) throw new PayRuntimeError('REQUEST_TOO_LARGE', 413, 'Request body is too large.');

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new PayRuntimeError('REQUEST_TOO_LARGE', 413, 'Request body is too large.');

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new PayRuntimeError('INVALID_JSON', 400, 'Request body must be valid JSON.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new PayRuntimeError('INVALID_JSON', 400, 'Request body must be a JSON object.');
  return parsed as Record<string, unknown>;
}

function getSupabaseBaseUrl(env: PayRuntimeEnv): string {
  return (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
}

function getSupabaseSecret(env: PayRuntimeEnv): string {
  return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
}

export async function supabaseRequest(env: PayRuntimeEnv, path: string, init: RequestInit = {}): Promise<Response> {
  const secret = getSupabaseSecret(env);
  if (!secret) throw new PayRuntimeError('SERVER_MISCONFIGURED', 503, 'Pay backend is not configured.');
  const headers = new Headers(init.headers);
  headers.set('apikey', secret);
  if (!env.SUPABASE_SECRET_KEY && env.SUPABASE_SERVICE_ROLE_KEY) headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  const response = await fetch(`${getSupabaseBaseUrl(env)}${path}`, { ...init, headers });
  if (!response.ok) {
    const upstream = (await response.text()).slice(0, 500);
    console.error(JSON.stringify({ scope: 'pay:supabase', status: response.status, body: upstream }));
    throw new PayRuntimeError('UPSTREAM_DATABASE_ERROR', 503, 'Pay data service is unavailable.');
  }
  return response;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getBearerToken(request: Request): string {
  const header = request.headers.get('Authorization') || '';
  return /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, '').trim() : '';
}

export async function authenticateMerchantApi(env: PayRuntimeEnv, request: Request, requiredScope: string): Promise<PayApiPrincipal> {
  const token = getBearerToken(request);
  if (!token || !validateApiKeyFormat(token)) throw new PayRuntimeError('UNAUTHORIZED', 401, 'Valid Pay API credentials are required.');

  const keyHash = await sha256Hex(token);
  const response = await supabaseRequest(env, `/rest/v1/pay_api_keys?select=id,merchant_id,key_hash,scopes,expires_at,revoked_at&key_hash=eq.${encodeURIComponent(keyHash)}&limit=1`, { headers: { Accept: 'application/json' } });
  const rows = await response.json() as Array<{ id: string; merchant_id: string; key_hash: string; scopes: string[]; expires_at: string | null; revoked_at: string | null }>;
  const record = rows[0];
  if (!record) throw new PayRuntimeError('UNAUTHORIZED', 401, 'Valid Pay API credentials are required.');

  const validation = validateApiKeyRecord({ merchantId: record.merchant_id, keyId: record.id, keyHash: record.key_hash, scopes: record.scopes || [], expiresAt: record.expires_at, revokedAt: record.revoked_at }, requiredScope);
  if (!validation.valid) {
    const forbidden = validation.reason === 'SCOPE_REQUIRED';
    throw new PayRuntimeError(forbidden ? 'FORBIDDEN' : 'UNAUTHORIZED', forbidden ? 403 : 401, 'Pay API credential is not authorized.');
  }

  await supabaseRequest(env, `/rest/v1/pay_api_keys?id=eq.${encodeURIComponent(record.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ last_used_at: new Date().toISOString() }) }).catch((error) => console.warn('Pay API key last_used_at update failed:', error));
  return { merchantId: record.merchant_id, keyId: record.id, scopes: record.scopes || [] };
}

export async function assertIdempotencyKey(request: Request): Promise<string> {
  const value = request.headers.get('Idempotency-Key')?.trim() || '';
  if (!value || value.length > MAX_IDEMPOTENCY_KEY_LENGTH || !validateIdempotencyKey(value)) throw new PayRuntimeError('INVALID_IDEMPOTENCY_KEY', 400, 'A valid Idempotency-Key header is required.');
  return value;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(',')}}`;
}

export async function hashCanonicalRequest(body: Record<string, unknown>): Promise<string> {
  return sha256Hex(canonicalize(body));
}

export function calculateSnapshot(amountAtomic: string, feePayer: 'merchant' | 'customer', feeBps = 100) {
  return calculateGatewayFee(amountAtomic, feeBps, feePayer);
}

export function assertSafeMetadata(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PayRuntimeError('INVALID_METADATA', 400, 'Metadata must be a JSON object.');
  if (!validatePublicMetadata(value)) throw new PayRuntimeError('INVALID_METADATA', 400, 'Metadata is too large or has an invalid structure.');
  return value as Record<string, unknown>;
}
