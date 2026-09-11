import { defaultPayHttpClient, type PayHttpClient } from '../http';

export type PayApiKeyStatus = 'active' | 'expired' | 'revoked';
export const PAY_API_KEY_SCOPE = 'payment.create' as const;

export interface PayApiKey {
  id: string;
  merchantId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: PayApiKeyStatus;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface PayApiKeyMutationResult {
  apiKey: PayApiKey;
  secret?: string;
  secretAvailable?: boolean;
  replacedKeyId?: string;
}

interface ApiKeyListEnvelope { apiKeys?: unknown; }
interface ApiKeyMutationEnvelope { apiKey?: unknown; secret?: unknown; secretAvailable?: unknown; replacedKeyId?: unknown; }

function parseApiKey(value: unknown): PayApiKey {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid API key response.');
  const row = value as Record<string, unknown>;
  const status = row.status;
  if (
    typeof row.id !== 'string' || typeof row.merchantId !== 'string' || typeof row.name !== 'string' ||
    typeof row.keyPrefix !== 'string' || !Array.isArray(row.scopes) || row.scopes.some(scope => typeof scope !== 'string') ||
    typeof status !== 'string' || !['active', 'expired', 'revoked'].includes(status) ||
    (row.expiresAt !== null && typeof row.expiresAt !== 'string') ||
    (row.revokedAt !== null && typeof row.revokedAt !== 'string') ||
    (row.lastUsedAt !== null && typeof row.lastUsedAt !== 'string') ||
    typeof row.createdAt !== 'string'
  ) throw new TypeError('Invalid API key response.');
  return {
    id: row.id,
    merchantId: row.merchantId,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: row.scopes as string[],
    status: status as PayApiKeyStatus,
    expiresAt: row.expiresAt as string | null,
    revokedAt: row.revokedAt as string | null,
    lastUsedAt: row.lastUsedAt as string | null,
    createdAt: row.createdAt,
  };
}

function parseMutation(payload: ApiKeyMutationEnvelope): PayApiKeyMutationResult {
  return {
    apiKey: parseApiKey(payload.apiKey),
    secret: typeof payload.secret === 'string' ? payload.secret : undefined,
    secretAvailable: typeof payload.secretAvailable === 'boolean' ? payload.secretAvailable : undefined,
    replacedKeyId: typeof payload.replacedKeyId === 'string' ? payload.replacedKeyId : undefined,
  };
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`;
}

function encodeId(value: string): string {
  return encodeURIComponent(value);
}

function normalizeExpiresAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) throw new TypeError('Invalid expiration date.');
  return new Date(timestamp).toISOString();
}

export async function listMerchantApiKeys(
  merchantId: string,
  client: PayHttpClient = defaultPayHttpClient,
): Promise<PayApiKey[]> {
  const payload = await client.request<ApiKeyListEnvelope>(`/api/pay/v1/merchants/${encodeId(merchantId)}/api-keys`);
  if (!Array.isArray(payload.apiKeys)) throw new TypeError('Invalid API key list response.');
  return payload.apiKeys.map(parseApiKey);
}

export async function createMerchantApiKey(
  merchantId: string,
  input: { name: string; expiresAt?: string | null },
  client: PayHttpClient = defaultPayHttpClient,
): Promise<PayApiKeyMutationResult> {
  const payload = await client.request<ApiKeyMutationEnvelope>(`/api/pay/v1/merchants/${encodeId(merchantId)}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': createIdempotencyKey() },
    body: JSON.stringify({ name: input.name.trim(), scopes: [PAY_API_KEY_SCOPE], expiresAt: normalizeExpiresAt(input.expiresAt) }),
  });
  return parseMutation(payload);
}

export async function revokeMerchantApiKey(
  merchantId: string,
  keyId: string,
  client: PayHttpClient = defaultPayHttpClient,
): Promise<PayApiKey> {
  const payload = await client.request<ApiKeyMutationEnvelope>(`/api/pay/v1/merchants/${encodeId(merchantId)}/api-keys/${encodeId(keyId)}`, { method: 'DELETE' });
  return parseApiKey(payload.apiKey);
}

export async function rotateMerchantApiKey(
  merchantId: string,
  keyId: string,
  input: { name: string; expiresAt?: string | null },
  client: PayHttpClient = defaultPayHttpClient,
): Promise<PayApiKeyMutationResult> {
  const payload = await client.request<ApiKeyMutationEnvelope>(`/api/pay/v1/merchants/${encodeId(merchantId)}/api-keys/${encodeId(keyId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': createIdempotencyKey() },
    body: JSON.stringify({ name: input.name.trim(), scopes: [PAY_API_KEY_SCOPE], expiresAt: normalizeExpiresAt(input.expiresAt) }),
  });
  return parseMutation(payload);
}
