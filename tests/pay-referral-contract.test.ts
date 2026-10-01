import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoute = readFileSync('functions/api/pay/v1/referrals.ts','utf8');
const publicRoute = readFileSync('functions/r/[code].ts','utf8');
const migration = readFileSync('supabase/migrations/20260930210000_solmint_pay_referral_program.sql','utf8');
const shortCodeMigration = readFileSync('supabase/migrations/20261001071009_solmint_pay_referral_short_codes.sql','utf8');
const shortCodeRuntimeFixMigration = readFileSync('supabase/migrations/20261001071819_solmint_pay_referral_short_code_runtime_fix.sql','utf8');
const attribution = readFileSync('functions/api/pay/_shared/referralAttribution.ts','utf8');
const auth = readFileSync('functions/api/auth/_instance.ts','utf8');
const authRoute = readFileSync('functions/api/auth/[[path]].ts','utf8');
const email = readFileSync('functions/api/auth/_email.ts','utf8');
const browserWorkflow = readFileSync('.github/workflows/solmint-pay-production-browser-ui.yml','utf8');
const liveSmokeWorkflow = readFileSync('.github/workflows/solmint-pay-live-smoke.yml','utf8');
const liveAuditWorkflow = readFileSync('.github/workflows/solmint-pay-live-audit.yml','utf8');
const routes = JSON.parse(readFileSync('public/_routes.json','utf8')) as { include?: string[] };

test('Referral dashboard uses the released server-side contract', () => {
  assert.match(apiRoute,/pay_get_referral_dashboard/);
  assert.match(apiRoute,/resolvePayIdentity\(request, env\)/);
  assert.match(apiRoute,/supabaseRequestAsIdentity\(/);
  assert.doesNotMatch(apiRoute,/SUPABASE_SERVICE_ROLE_KEY/);
});

test('Referral public route records a click and preserves signup attribution in an HttpOnly cookie', () => {
  assert.match(publicRoute,/recordReferralClick\(env, code\)/);
  assert.match(attribution,/REFERRAL_COOKIE_NAME = 'solmint_referral_click'/);
  assert.match(attribution,/HttpOnly; SameSite=Lax/);
  assert.match(publicRoute,/Cache-Control/);
  assert.match(publicRoute,/status: 302/);
  assert.match(publicRoute,/new URL/);
  assert.ok(publicRoute.includes("new URL('/', requestUrl.origin)"));
  assert.ok(publicRoute.includes('sm_[0-9a-f]{12}'));
  assert.doesNotMatch(publicRoute,/pay_referral_code_aliases/);
  assert.doesNotMatch(publicRoute,/auth=register/);
  assert.match(publicRoute,/enforcePayRateLimit/);
  assert.match(publicRoute,/hashCanonicalRequest/);
});

test('Referral persistence is explicitly single-level and per-user', () => {
  assert.match(migration,/pay_referral_user_attributions/);
  assert.match(migration,/referred_user_id text not null unique/);
  assert.match(migration,/pay_referrals_merchant_id_unique_idx/);
  assert.match(migration,/drop constraint if exists pay_referrals_referral_code_key/);
  assert.match(migration,/commission_rate_bps set default 5000/);
  assert.match(migration,/pay_affiliates_fixed_commission_rate_check/);
  assert.match(migration,/v_commission_bps := 5000/);
  assert.ok(shortCodeMigration.includes('sm_[0-9a-f]{12}'));
  assert.match(shortCodeMigration,/pay_affiliates_short_referral_code_check/);
  assert.match(shortCodeMigration,/encode\(gen_random_bytes\(6\), 'hex'\)/);
  assert.match(shortCodeRuntimeFixMigration,/extensions\.gen_random_bytes\(6\)/);
});

test('Referral commission is recognized only at the authoritative revenue-ledger boundary', () => {
  assert.match(migration,/create trigger pay_revenue_ledger_referral_commission/);
  assert.match(migration,/gross_gateway_fee_atomic \* v_commission_bps/);
  assert.match(migration,/floor\(/);
  assert.match(migration,/commission_bps/);
  assert.doesNotMatch(attribution,/commission_atomic/);
});

test('Referral attribution rejects pre-existing accounts and is retry-safe', () => {
  assert.match(migration,/USER_PREEXISTED_CLICK/);
  assert.match(migration,/CLICK_ALREADY_CONSUMED/);
  assert.match(migration,/ALREADY_ATTRIBUTED/);
  assert.match(migration,/on conflict \(referral_id, payment_id\) do nothing/);
});

test('Referral cookie parsing supports Better Auth cookie context directly', () => {
  assert.match(attribution, /parseReferralCookieValue\(value: string \| null \| undefined\)/);
  assert.match(auth, /readReferralCookieFromAuthContext\(ctx\)/);
  assert.match(auth, /ctx\.getCookie\('solmint_referral_click'\)/);
  assert.match(auth, /parseReferralCookieValue\(authCookieValue\)/);
  assert.match(auth, /readReferralCookie\(ctx\.headers\)/);
  assert.match(auth, /readReferralCookie\(ctx\.request\)/);
});

test('Native signup attribution captures the referral cookie before Better Auth and uses it after a successful signup response', () => {
  assert.match(auth, /export async function processReferralSignupFromRequest\(/);
  const capture = authRoute.indexOf('const nativeReferralClick = isNativeEmailSignup ? readReferralCookie(request) : null;');
  const handler = authRoute.indexOf('const response = await runtime.auth.handler(request);');
  const attribution = authRoute.indexOf('await processReferralSignupFromRequest(');
  assert.ok(capture >= 0, 'Native signup must capture referral context before Better Auth runs.');
  assert.ok(handler > capture, 'Referral context must be captured before Better Auth consumes the request lifecycle.');
  assert.ok(attribution > handler, 'Referral attribution must run after Better Auth returns the successful signup response.');
  assert.match(authRoute, /nativeReferralClick/);
  assert.match(authRoute, /await response\.clone\(\)\.json\(\)/);
  assert.doesNotMatch(auth, /ctx\.path === '\/sign-up\/email'\) \{[\s\S]*?attributeReferralFromClick/);
});

test('Google OAuth referral context and localized welcome use server-trusted OAuth state', () => {
  assert.match(auth,/addOAuthServerContext/);
  assert.match(auth,/getOAuthState/);
  assert.match(auth,/serverContext/);
  assert.match(auth,/authEmailLocale/);
  assert.match(auth,/callback\/google/);
  assert.match(auth,/sendGoogleWelcomeNotification/);
});

test('Referral signup notification remains informational', () => {
  assert.match(email,/referralSignup/);
  assert.match(email,/not the source of commission or settlement truth|مبنای محاسبه درآمد یا تسویه نیست/);
});


test('Current public referral routing has no legacy alias contract', () => {
  assert.ok(routes.include?.includes('/r/*'));
  assert.doesNotMatch(shortCodeMigration,/pay_referral_code_aliases/);
  assert.match(publicRoute,/const CODE = \/\^sm_\[0-9a-f\]\{12\}\$\/i/);
});

test('Referral route changes trigger production browser and live smoke verification', () => {
  for (const workflow of [browserWorkflow, liveSmokeWorkflow, liveAuditWorkflow]) {
    assert.match(workflow, /functions\/r\/\*\*/);
    assert.match(workflow, /supabase\/migrations\/\*solmint_pay_referral\*\.sql/);
  }
});
