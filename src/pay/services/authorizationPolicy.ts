/**
 * Server-side Pay authorization policy.
 *
 * Authentication identifies the caller; the merchant membership record identifies
 * which organization the caller belongs to and which capabilities that member has.
 * The frontend/domain layer intentionally depends only on this small principal
 * contract and never imports the site's concrete auth implementation.
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

export function hasPayCapability(user: PayUserPrincipal, capability: PayCapability): boolean {
  if (!user.isActive) return false;
  if (user.role === 'superadmin') return true;
  return user.permissions.some((permission) => permission === `pay:${capability}` || permission === capability);
}

export function authorizePayMerchant(
  user: PayUserPrincipal | null,
  merchant: MerchantPrincipal | null,
  membership: MerchantMembership | null,
  capability: PayCapability,
): boolean {
  if (!user || !merchant || !membership) return false;
  if (merchant.status === 'suspended' || merchant.status === 'closed') return false;
  if (membership.status !== 'active' || membership.merchantId !== merchant.merchantId || membership.userId !== user.id) return false;
  if (user.role === 'superadmin') return true;
  if (user.id !== merchant.ownerUserId && membership.role === 'owner') return false;
  if (!hasPayCapability(user, capability)) return false;
  return roleCapabilities[membership.role].includes(capability);
}
