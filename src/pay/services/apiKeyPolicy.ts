/**
 * Security policy for merchant API credentials.
 *
 * API keys are bearer credentials. The Pay runtime must only persist a one-way
 * digest, scope every key to one merchant, and require explicit revocation or
 * expiry before a credential stops being accepted.
 */

export const API_KEY_PREFIX = 'sk_pay_';
export const API_KEY_SCOPE = 'payment.create';
export const API_KEY_SECRET_BYTES = 48;
export const API_KEY_DISPLAY_PREFIX_LENGTH = 16;
const MIN_SECRET_BYTES = 32;

export interface ApiKeyRecord {
  merchantId: string;
  keyId: string;
  keyHash: string;
  scopes: readonly string[];
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface ApiKeyValidation {
  valid: boolean;
  reason: 'OK' | 'MALFORMED' | 'REVOKED' | 'EXPIRED' | 'SCOPE_REQUIRED';
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createApiKeySecret(): string {
  const bytes = new Uint8Array(API_KEY_SECRET_BYTES);
  crypto.getRandomValues(bytes);
  return `${API_KEY_PREFIX}${base64Url(bytes)}`;
}

export async function hashApiKeySecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function apiKeyDisplayPrefix(secret: string): string {
  return secret.slice(0, API_KEY_DISPLAY_PREFIX_LENGTH);
}

export function validateApiKeyFormat(value: string): boolean {
  return new RegExp(`^${API_KEY_PREFIX}[A-Za-z0-9_-]{${MIN_SECRET_BYTES * 2},}$`).test(value);
}

export function validateApiKeyRecord(record: ApiKeyRecord, requiredScope?: string, nowMs = Date.now()): ApiKeyValidation {
  if (record.revokedAt) return { valid: false, reason: 'REVOKED' };
  if (record.expiresAt && Date.parse(record.expiresAt) <= nowMs) return { valid: false, reason: 'EXPIRED' };
  if (requiredScope && !record.scopes.includes(requiredScope)) return { valid: false, reason: 'SCOPE_REQUIRED' };
  return { valid: true, reason: 'OK' };
}
