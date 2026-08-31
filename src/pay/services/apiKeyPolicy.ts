/**
 * Security policy for merchant API credentials.
 *
 * API keys are bearer credentials. The Pay runtime must only persist a one-way
 * digest, scope every key to one merchant, and require explicit revocation or
 * expiry before a credential stops being accepted.
 */

const API_KEY_PREFIX = 'sk_pay_';
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

export function validateApiKeyFormat(value: string): boolean {
  return new RegExp(`^${API_KEY_PREFIX}[A-Za-z0-9_-]{${MIN_SECRET_BYTES * 2},}$`).test(value);
}

export function validateApiKeyRecord(record: ApiKeyRecord, requiredScope?: string, nowMs = Date.now()): ApiKeyValidation {
  if (record.revokedAt) return { valid: false, reason: 'REVOKED' };
  if (record.expiresAt && Date.parse(record.expiresAt) <= nowMs) return { valid: false, reason: 'EXPIRED' };
  if (requiredScope && !record.scopes.includes(requiredScope)) return { valid: false, reason: 'SCOPE_REQUIRED' };
  return { valid: true, reason: 'OK' };
}
