import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authorizeSubscriptionMerchantCapability,
  type SubscriptionMerchantCapability,
} from '../src/pay/services/subscriptionAuthorizationPolicy';
import type {
  MerchantMembership,
  MerchantPrincipal,
  PayUserPrincipal,
} from '../src/pay/services/authorizationPolicy';

const USER_ID = 'user-100';
const MERCHANT_ID = 'merchant-100';

function principals(
  role: MerchantMembership['role'],
  overrides: {
    user?: Partial<PayUserPrincipal>;
    merchant?: Partial<MerchantPrincipal>;
    membership?: Partial<MerchantMembership>;
  } = {},
) {
  const user: PayUserPrincipal = {
    id: USER_ID,
    role: 'member',
    permissions: [],
    isActive: true,
    ...overrides.user,
  };
  const merchant: MerchantPrincipal = {
    merchantId: MERCHANT_ID,
    ownerUserId: USER_ID,
    status: 'active',
    ...overrides.merchant,
  };
  const membership: MerchantMembership = {
    merchantId: MERCHANT_ID,
    userId: USER_ID,
    role,
    status: 'active',
    ...overrides.membership,
  };
  return { user, merchant, membership };
}

const CAPABILITIES: readonly SubscriptionMerchantCapability[] = [
  'plan.manage',
  'subscription.manage',
  'ledger.read',
  'retry.recover',
  'refund.reverse',
  'customer.record.manage',
];

test('owner receives every owner-selected Subscription capability', () => {
  const input = principals('owner');
  for (const capability of CAPABILITIES) {
    assert.deepEqual(
      authorizeSubscriptionMerchantCapability({ ...input, capability }),
      { allowed: true, capability },
    );
  }
});

test('admin receives selected administration and recovery capabilities but cannot approve refunds', () => {
  const input = principals('admin');
  for (const capability of CAPABILITIES.filter((item) => item !== 'refund.reverse')) {
    assert.equal(authorizeSubscriptionMerchantCapability({ ...input, capability }).allowed, true);
  }
  assert.deepEqual(
    authorizeSubscriptionMerchantCapability({ ...input, capability: 'refund.reverse' }),
    { allowed: false, capability: 'refund.reverse', reason: 'role_not_authorized' },
  );
});

test('finance receives Subscription administration and ledger/report access only', () => {
  const input = principals('finance');
  for (const capability of ['subscription.manage', 'ledger.read'] as const) {
    assert.equal(authorizeSubscriptionMerchantCapability({ ...input, capability }).allowed, true);
  }
  for (const capability of [
    'plan.manage',
    'retry.recover',
    'refund.reverse',
    'customer.record.manage',
  ] as const) {
    assert.equal(authorizeSubscriptionMerchantCapability({ ...input, capability }).allowed, false);
  }
});

test('developer and viewer do not inherit Subscription administration capabilities', () => {
  for (const role of ['developer', 'viewer'] as const) {
    const input = principals(role);
    for (const capability of CAPABILITIES) {
      assert.equal(authorizeSubscriptionMerchantCapability({ ...input, capability }).allowed, false);
    }
  }
});

test('platform superadmin does not bypass merchant membership or Subscription role matrix', () => {
  const input = principals('viewer', { user: { role: 'superadmin' } });
  assert.deepEqual(
    authorizeSubscriptionMerchantCapability({ ...input, capability: 'refund.reverse' }),
    { allowed: false, capability: 'refund.reverse', reason: 'role_not_authorized' },
  );
  assert.deepEqual(
    authorizeSubscriptionMerchantCapability({
      ...input,
      membership: null,
      capability: 'subscription.manage',
    }),
    { allowed: false, capability: 'subscription.manage', reason: 'missing_principal' },
  );
});

test('rejects inactive, suspended, pending and cross-tenant principals', () => {
  const base = principals('owner');
  assert.equal(authorizeSubscriptionMerchantCapability({
    ...base,
    user: { ...base.user, isActive: false },
    capability: 'subscription.manage',
  }).allowed, false);

  assert.equal(authorizeSubscriptionMerchantCapability({
    ...base,
    merchant: { ...base.merchant, status: 'suspended' },
    capability: 'subscription.manage',
  }).allowed, false);

  assert.deepEqual(authorizeSubscriptionMerchantCapability({
    ...base,
    merchant: { ...base.merchant, status: 'pending' },
    capability: 'subscription.manage',
  }), {
    allowed: false,
    capability: 'subscription.manage',
    reason: 'merchant_not_active',
  });

  assert.deepEqual(authorizeSubscriptionMerchantCapability({
    ...base,
    membership: { ...base.membership, merchantId: 'merchant-other' },
    capability: 'subscription.manage',
  }), {
    allowed: false,
    capability: 'subscription.manage',
    reason: 'membership_tenant_mismatch',
  });
});

test('rejects removed/suspended memberships, user mismatch and forged owner role', () => {
  const base = principals('owner');
  assert.equal(authorizeSubscriptionMerchantCapability({
    ...base,
    membership: { ...base.membership, status: 'removed' },
    capability: 'subscription.manage',
  }).allowed, false);

  assert.equal(authorizeSubscriptionMerchantCapability({
    ...base,
    membership: { ...base.membership, userId: 'user-other' },
    capability: 'subscription.manage',
  }).allowed, false);

  assert.deepEqual(authorizeSubscriptionMerchantCapability({
    ...base,
    merchant: { ...base.merchant, ownerUserId: 'real-owner' },
    capability: 'plan.manage',
  }), {
    allowed: false,
    capability: 'plan.manage',
    reason: 'owner_identity_mismatch',
  });
});
