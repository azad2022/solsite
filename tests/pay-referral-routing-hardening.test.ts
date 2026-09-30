import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routes = JSON.parse(readFileSync('public/_routes.json', 'utf8')) as {
  include?: string[];
};
const route = readFileSync('functions/r/[code].ts', 'utf8');
const attribution = readFileSync('functions/api/pay/_shared/referralAttribution.ts', 'utf8');
const hardening = readFileSync(
  'supabase/migrations/20261001010000_solmint_pay_referral_hardening.sql',
  'utf8',
);

test('Cloudflare Pages invokes the referral Function route', () => {
  assert.ok(routes.include?.includes('/r/*'), 'public/_routes.json must invoke Functions for /r/*');
});

test('Referral clicks land on the real homepage after tracking', () => {
  assert.match(route, /new URL\('\/', requestUrl\.origin\)/);
  assert.doesNotMatch(route, /auth=register/);
});

test('Referral attribution persists long enough to survive a delayed signup', () => {
  assert.match(attribution, /REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 \* 60 \* 24 \* 30/);
  assert.match(attribution, /Max-Age=\$\{REFERRAL_COOKIE_MAX_AGE_SECONDS\}/);
});

test('Short referral codes replace the 35-character UUID-shaped public code', () => {
  assert.match(hardening, /pay_referral_code_aliases/);
  assert.match(hardening, /encode\(gen_random_bytes\(8\), 'hex'\)/);
  assert.match(hardening, /pay_affiliates_referral_code_shape_check/);
  assert.match(hardening, /legacy_referral_code/);
});

test('Legacy referral codes resolve to the affiliate current code', () => {
  assert.match(hardening, /alias\.legacy_referral_code = v_code/);
  assert.match(hardening, /return jsonb_build_object\([\s\S]*'referral_code', v_affiliate\.referral_code/);
});

test('Affiliate provisioning generates short codes for future users', () => {
  const ensureSection = hardening.slice(hardening.indexOf('create or replace function public.pay_ensure_affiliate'));
  assert.match(ensureSection, /v_code := 'sm_' \|\| encode\(gen_random_bytes\(8\), 'hex'\)/);
});

test('Public referral route is protected by a server-side click rate limit', () => {
  assert.match(route, /enforceReferralClickRateLimit\(env, request\)/);
  assert.match(attribution, /pay_check_and_increment_rate_limit/);
  assert.match(attribution, /p_scope: 'referral_click'/);
  assert.match(attribution, /p_max_requests: 60/);
});
