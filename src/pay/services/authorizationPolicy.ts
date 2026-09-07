/**
 * Server-side Pay authorization policy.
 *
 * Authentication identifies the caller; merchant membership identifies the tenant
 * and role. Tenant authorization must not depend on an unrelated site-wide
 * permission flag, otherwise valid merchant team members could be denied simply
 * because their account predates Pay permissions. Platform-wide administrative
 * operations remain separately gated by the caller's platform role.
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

export type MerchantMemberRole = 'owner' | 'admin' | 'finance' | 'developer' | 'viewer';

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

export interface MerchantMembership {
  merchantId: string;
  userId: string;
  role: MerchantMemberRole;
  status: 'active' | 'suspended' | 'removed';
}

const roleCapabilities: Record<MerchantMemberRole, readonly PayCapability[]> = {
  owner: ['merchant.read','merchant.manage','payment.read','payment.create','payment.refund','invoice.manage','webhook.manage','api_key.manage','gas.manage','referral.read'],
  admin: ['merchant.read','merchant.manage','payment.read','payment.create','payment.refund','invoice.manage','webhook.manage','api_key.manage','gas.manage','referral.read'],
  finance: ['merchant.read','payment.read','payment.refund','invoice.manage','referral.read'],
  developer: ['merchant.read','payment.read','payment.create','webhook.manage','api_key.manage'],
  viewer: ['merchant.read','payment.read','referral.read'],
};

/** Platform-level Pay capability check for administrative operations. */
export function hasPayPlatformCapability(user: PayUserPrincipal, capability: PayCapability): boolean {
  if (!user.isActive) return false;
  if (user.role === 'superadmin') return true;
  return user.permissions.some((permission) => permission === `pay:${capability}` || permission === capability);
}

/** Tenant-scoped authorization; merchant membership role is authoritative. */
export function authorizePayMerchant(
  user: PayUserPrincipal | null,
  merchant: MerchantPrincipal | null,
  membership: MerchantMembership | null,
  capability: PayCapability,
): boolean {
  if (!user || !merchant || !membership || !user.isActive) return false;
  if (merchant.status === 'suspended' || merchant.status === 'closed') return false;
  if (membership.status !== 'active' || membership.merchantId !== merchant.merchantId || membership.userId !== user.id) return false;
  if (membership.role === 'owner' && membership.userId !== merchant.ownerUserId) return false;
  if (user.role === 'superadmin') return true;
  return roleCapabilities[membership.role].includes(capability);
}
