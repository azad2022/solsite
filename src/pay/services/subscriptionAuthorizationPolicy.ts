import type {
  MerchantMembership,
  MerchantPrincipal,
  PayUserPrincipal,
} from './authorizationPolicy';

/**
 * Subscription-specific merchant capabilities selected in Decision Register
 * v1.1 (2026-11-19). This is a pure policy helper only: it is not connected to
 * an API route, database grant, RLS policy, or production authorization path.
 *
 * Customer self-service is intentionally absent because D-010 does not decide
 * Customer permissions. Application superadmin does not bypass membership or
 * this Subscription role matrix.
 */
export type SubscriptionMerchantCapability =
  | 'plan.manage'
  | 'subscription.manage'
  | 'ledger.read'
  | 'retry.recover'
  | 'refund.reverse'
  | 'customer.record.manage';

export type SubscriptionAuthorizationFailure =
  | 'missing_principal'
  | 'inactive_user'
  | 'merchant_not_active'
  | 'membership_not_active'
  | 'membership_tenant_mismatch'
  | 'membership_user_mismatch'
  | 'owner_identity_mismatch'
  | 'role_not_authorized';

export type SubscriptionAuthorizationDecision =
  | { allowed: true; capability: SubscriptionMerchantCapability }
  | {
      allowed: false;
      capability: SubscriptionMerchantCapability;
      reason: SubscriptionAuthorizationFailure;
    };

const CAPABILITIES_BY_ROLE: Record<
  MerchantMembership['role'],
  readonly SubscriptionMerchantCapability[]
> = {
  owner: [
    'plan.manage',
    'subscription.manage',
    'ledger.read',
    'retry.recover',
    'refund.reverse',
    'customer.record.manage',
  ],
  admin: [
    'plan.manage',
    'subscription.manage',
    'ledger.read',
    'retry.recover',
    'customer.record.manage',
  ],
  finance: ['subscription.manage', 'ledger.read'],
  developer: [],
  viewer: [],
};

export interface AuthorizeSubscriptionMerchantInput {
  user: PayUserPrincipal | null;
  merchant: MerchantPrincipal | null;
  membership: MerchantMembership | null;
  capability: SubscriptionMerchantCapability;
}

/**
 * Evaluates only the owner-selected role matrix. The caller must still enforce
 * the returned decision server-side and independently enforce DB membership,
 * RLS and grants. Pending merchants fail closed until activation semantics are
 * explicitly frozen for Subscription.
 */
export function authorizeSubscriptionMerchantCapability(
  input: AuthorizeSubscriptionMerchantInput,
): SubscriptionAuthorizationDecision {
  const { user, merchant, membership, capability } = input;
  const deny = (reason: SubscriptionAuthorizationFailure): SubscriptionAuthorizationDecision => ({
    allowed: false,
    capability,
    reason,
  });

  if (!user || !merchant || !membership) return deny('missing_principal');
  if (!user.isActive) return deny('inactive_user');
  if (merchant.status !== 'active') return deny('merchant_not_active');
  if (membership.status !== 'active') return deny('membership_not_active');
  if (membership.merchantId !== merchant.merchantId) return deny('membership_tenant_mismatch');
  if (membership.userId !== user.id) return deny('membership_user_mismatch');
  if (membership.role === 'owner' && membership.userId !== merchant.ownerUserId) {
    return deny('owner_identity_mismatch');
  }

  // Platform superadmin deliberately does not bypass this merchant role map.
  if (!CAPABILITIES_BY_ROLE[membership.role].includes(capability)) {
    return deny('role_not_authorized');
  }

  return { allowed: true, capability };
}
