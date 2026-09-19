import assert from 'node:assert/strict';
import test from 'node:test';
import { createPayReferralService } from '../src/pay/services/referralService';
import type { PayHttpClient } from '../src/pay/http';

const affiliateId = '11111111-1111-4111-8111-111111111111';
const merchantId = '22222222-2222-4222-8222-222222222222';
const referralId = '33333333-3333-4333-8333-333333333333';
const paymentId = '44444444-4444-4444-8444-444444444444';
const affiliate = { id:affiliateId, display_name:'Partner', referral_code:'PARTNER1', commission_rate_bps:500, status:'active', created_at:'2026-09-18T00:00:00Z', updated_at:'2026-09-18T00:00:00Z' };
const referral = { id:referralId, affiliate_id:affiliateId, merchant_id:merchantId, referral_code:'PARTNER1', attributed_at:'2026-09-18T00:00:00Z', active:true };
const commission = { id:'55555555-5555-4555-8555-555555555555', referral_id:referralId, payment_id:paymentId, gross_gateway_fee_atomic:'1000', commission_bps:500, commission_atomic:'50', status:'pending', created_at:'2026-09-18T00:00:00Z', approved_at:null, paid_at:null };

function clientFor(payload: unknown): PayHttpClient {
  return { request: async <T>() => payload as T } as unknown as PayHttpClient;
}

test('referral service parses the released read snapshot', async () => {
  const snapshot = await createPayReferralService(clientFor({success:true,apiVersion:'v1',data:{affiliates:[affiliate],referrals:[referral],commissions:[commission]}})).load();
  assert.equal(snapshot.affiliates[0]?.referral_code,'PARTNER1');
  assert.equal(snapshot.referrals[0]?.merchant_id,merchantId);
  assert.equal(snapshot.commissions[0]?.commission_atomic,'50');
});

test('referral service rejects malformed atomic commission values', async () => {
  await assert.rejects(
    () => createPayReferralService(clientFor({success:true,apiVersion:'v1',data:{affiliates:[affiliate],referrals:[referral],commissions:[{...commission,commission_atomic:'5.0'}]}})).load(),
    /Invalid Pay referral field: commission_atomic/,
  );
});

test('referral service validates the limit before requesting the backend', async () => {
  const service = createPayReferralService(clientFor({success:true,apiVersion:'v1',data:{affiliates:[],referrals:[],commissions:[]}}));
  await assert.rejects(() => service.load(0), /Referral limit is invalid/);
});
