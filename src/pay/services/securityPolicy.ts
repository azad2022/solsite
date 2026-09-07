/**
 * Pure security policy helpers for SolMint Pay.
 *
 * This module is intentionally free of network and storage access. Runtime
 * handlers must combine these predicates with authenticated identity and the
 * actual database/provider state before performing a sensitive operation.
 */

const MAX_IDEMPOTENCY_KEY_LENGTH = 255;
const MAX_EXTERNAL_ID_LENGTH = 255;
const MAX_PUBLIC_METADATA_BYTES = 4096;
const MAX_WEBHOOK_URL_LENGTH = 2048;

export function validateIdempotencyKey(value: string): boolean {
  return value.length > 0 && value.length <= MAX_IDEMPOTENCY_KEY_LENGTH && !/[\r\n]/.test(value);
}

export function validateExternalOrderId(value: string | null | undefined): boolean {
  if (value == null) return true;
  return value.length > 0 && value.length <= MAX_EXTERNAL_ID_LENGTH && !/[\u0000-\u001f\u007f]/.test(value);
}

export function validatePublicMetadata(metadata: unknown): boolean {
  try {
    const encoded = JSON.stringify(metadata ?? {});
    return new TextEncoder().encode(encoded).byteLength <= MAX_PUBLIC_METADATA_BYTES;
  } catch {
    return false;
  }
}

/**
 * First-line SSRF filter. Production delivery must also perform safe DNS
 * resolution with private/link-local/loopback/metadata ranges blocked and
 * re-check the resolved destination to defeat DNS rebinding.
 */
export function validateWebhookUrl(value: string): boolean {
  if (value.length === 0 || value.length > MAX_WEBHOOK_URL_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (host.includes(':')) return false; // Reject IP-literal IPv6 URLs at policy layer.
  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  if (host === 'metadata.google.internal' || host === 'metadata.google.com') return false;
  if (/^127(?:\.\d{1,3}){3}$/.test(host)) return false;
  if (/^10(?:\.\d{1,3}){3}$/.test(host)) return false;
  if (/^192\.168(?:\.\d{1,3}){2}$/.test(host)) return false;
  if (/^169\.254(?:\.\d{1,3}){2}$/.test(host)) return false;
  if (/^172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(host)) return false;
  return true;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason:
    | 'OK'
    | 'UNAUTHENTICATED'
    | 'MERCHANT_MISMATCH'
    | 'ROLE_FORBIDDEN'
    | 'RESOURCE_NOT_FOUND'
    | 'RESOURCE_SUSPENDED';
}

/** Central object-level authorization predicate for merchant-scoped handlers. */
export function authorizeMerchantResource(input: {
  authenticatedUserId: string | null;
  merchantOwnerUserId: string | null;
  requestedMerchantId: string | null;
  resourceMerchantId: string | null;
  merchantStatus: 'pending' | 'active' | 'suspended' | 'closed' | null;
  canManageMerchant: boolean;
}): AuthorizationDecision {
  if (!input.authenticatedUserId) return { allowed: false, reason: 'UNAUTHENTICATED' };
  if (!input.resourceMerchantId || !input.merchantOwnerUserId) return { allowed: false, reason: 'RESOURCE_NOT_FOUND' };
  if (!input.requestedMerchantId || input.requestedMerchantId !== input.resourceMerchantId) {
    return { allowed: false, reason: 'MERCHANT_MISMATCH' };
  }
  if (!input.canManageMerchant || input.authenticatedUserId !== input.merchantOwnerUserId) {
    return { allowed: false, reason: 'ROLE_FORBIDDEN' };
  }
  if (input.merchantStatus === 'suspended' || input.merchantStatus === 'closed') {
    return { allowed: false, reason: 'RESOURCE_SUSPENDED' };
  }
  return { allowed: true, reason: 'OK' };
}
