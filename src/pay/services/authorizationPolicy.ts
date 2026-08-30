/**
 * Server-side Pay authorization policy.
 *
 * This module intentionally depends only on a small principal contract. The
 * Pay domain must not import the concrete authentication implementation from
 * `functions/`, which keeps the frontend/domain layer independent from the
 * current session mechanism.
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

export interface PayUserPrincipal {
  id: string;
  role: string;
  permissions: readonly unknown[];
  isActive: boolean;
}

export interface MerchantPrincipal {
  merchantId: string;
  ownerUserId: string;
  status: 'pending' | 'active' | 'suspended' | 'closed';
}

export function hasPayCapability(user: PayUserPrincipal, capability: PayCapability): boolean {
  if (!user.isActive) return false;
  if (user.role === 'superadmin') return true;
  return user.permissions.some((permission) => permission === `pay:${capability}` || permission === capability);
}

export function authorizePayMerchant(
  user: PayUserPrincipal | null,
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
