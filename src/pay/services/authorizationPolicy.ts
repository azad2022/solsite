import type { AuthUser } from '../../../functions/api/auth/_shared';

/**
 * Maps the existing SolMint session identity to Pay-specific capabilities.
 * Payment operations must never trust a merchantId submitted by the client.
 * The authenticated principal is resolved server-side and the target merchant
 * is loaded from the database before this policy is evaluated.
 */

export type PayCapability =
  | 'merchant.read'
  | 'merchant.manage'
  | 'payment.read'
  | 'payment.create'
  | 'payment.refund'
  | 'invoice.manage'
  | 'webhook.manage'
  | 'api_key.manage'
  | 'gas.manage'
  | 'referral.read';

export interface MerchantPrincipal {
  merchantId: string;
  ownerUserId: string;
  status: 'pending' | 'active' | 'suspended' | 'closed';
}

export function hasPayCapability(user: AuthUser, capability: PayCapability): boolean {
  if (user.is_active === false) return false;
  if (user.role === 'superadmin') return true;
  if (!Array.isArray(user.permissions)) return false;
  return (user.permissions as unknown[]).some((permission) => permission === `pay:${capability}` || permission === capability);
}

export function authorizePayMerchant(
  user: AuthUser | null,
  merchant: MerchantPrincipal | null,
  requestedMerchantId: string | null,
  capability: PayCapability,
): boolean {
  if (!user || !merchant) return false;
  if (merchant.status === 'suspended' || merchant.status === 'closed') return false;
  if (requestedMerchantId !== merchant.merchantId) return false;
  if (user.id !== merchant.ownerUserId && user.role !== 'superadmin') return false;
  return hasPayCapability(user, capability);
}
