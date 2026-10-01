import assert from 'node:assert/strict';
import test from 'node:test';
import { createPayReferralService } from '../src/pay/services/referralService';
import type { PayHttpClient } from '../src/pay/http';

const affiliateId = '11111111-1111-4111-8111-111111111111';
const merchantId = '22222222-2222-4222-8222-222222222222';
const referralId = '33333333-3333-4333-8333-333333333333';
const paymentId = '44444444-4444-4444-8444-444444444444';

const affiliate = {
  id: affiliateId,
  display_name: 'Partner',
  referral_code: 'sm_4a7c91d2e6b4',
  commission_rate_bps: 5000,
  status: 'active',
  created_at: '2026-09-18T00:00:00Z',
  updated_at: '2026-09-18T00:00:00Z',
};

const referral = {
  id: referralId,
  affiliate_id: affiliateId,
  merchant_id: merchantId,
  referral_code: 'sm_4a7c91d2e6b4',
  attributed_at: '2026-09-18T00:00:00Z',
  active: true,
  user_attribution_id: '55555555-5555-4555-8555-555555555555',
};

const earning = {
  asset: 'USDC',
  token_decimals: 6,
  gross_gateway_fee_atomic: '1000000',
  commission_atomic: '500000',
  pending_commission_atomic: '500000',
  approved_commission_atomic: '0',
  paid_commission_atomic: '0',
  reversed_commission_atomic: '0',
};

const commission = {
  id: '66666666-6666-4666-8666-666666666666',
  referral_id: referralId,
  payment_id: paymentId,
  asset: 'USDC',
  token_decimals: 6,
  gross_gateway_fee_atomic: '1000000',
  commission_bps: 5000,
  commission_atomic: '500000',
  status: 'pending',
  created_at: '2026-09-18T00:00:00Z',
  approved_at: null,
  paid_at: null,
};

function clientFor(payload: unknown): PayHttpClient {
  return { request: async <T>() => payload as T } as unknown as PayHttpClient;
}

function envelope() {
  return {
    success: true,
    apiVersion: 'v1',
    data: {
      affiliate,
      stats: {
        clicks: '1000',
        directSignups: '80',
        referredMerchants: '80',
        activeReferredMerchants: '79',
      },
      earnings_by_asset: [earning],
      referrals: [referral],
      commissions: [commission],
    },
  };
}

test('referral service parses the released dashboard snapshot', async () => {
  const snapshot = await createPayReferralService(clientFor(envelope())).load();
  assert.equal(snapshot.affiliate.referral_code, 'sm_4a7c91d2e6b4');
  assert.equal(snapshot.affiliate.commission_rate_bps, 5000);
  assert.match(snapshot.affiliate.referral_code, /^sm_[0-9a-f]{12}$/);
  assert.equal(snapshot.stats.clicks, '1000');
  assert.equal(snapshot.stats.directSignups, '80');
  assert.equal(snapshot.earnings_by_asset[0]?.commission_atomic, '500000');
  assert.equal(snapshot.commissions[0]?.asset, 'USDC');
});

test('referral service rejects malformed atomic commission values', async () => {
  await assert.rejects(
    () => createPayReferralService(clientFor({
      ...envelope(),
      data: {
        ...envelope().data,
        earnings_by_asset: [{ ...earning, commission_atomic: '5.0' }],
      },
    })).load(),
    /Invalid Pay referral field: commission_atomic/,
  );
});

test('referral service rejects malformed dashboard counts', async () => {
  await assert.rejects(
    () => createPayReferralService(clientFor({
      ...envelope(),
      data: {
        ...envelope().data,
        stats: { ...envelope().data.stats, clicks: '1000.5' },
      },
    })).load(),
    /Invalid Pay referral count: clicks/,
  );
});

test('referral service validates the limit before requesting the backend', async () => {
  const service = createPayReferralService(clientFor(envelope()));
  await assert.rejects(() => service.load(0), /Referral limit is invalid/);
  await assert.rejects(() => service.load(101), /Referral limit is invalid/);
});
