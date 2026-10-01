import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { chromium } from 'playwright';

const ORIGIN = (process.env.SOLMINT_PAY_PRODUCTION_ORIGIN || 'https://solmint.ir').replace(/\/$/, '');
const SUPABASE_ACCESS_TOKEN = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const PROJECT_REF = 'nvopkbiedorfshwbmyhn';

function rows(value) {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === 'object');
  if (!value || typeof value !== 'object') return [];
  for (const key of ['rows', 'data', 'result']) {
    if (Array.isArray(value[key])) return rows(value[key]);
    if (value[key] && typeof value[key] === 'object') return rows(value[key]);
  }
  return [];
}

async function db(query, parameters = [], readOnly = false) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query, parameters, read_only: readOnly }),
  });
  if (!response.ok) throw new Error(`Supabase Management API query failed: HTTP ${response.status}`);
  return response.json();
}

async function provisionReferrer() {
  const id = crypto.randomUUID();
  const username = `pay_ref_${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}`;
  const email = `${username}@example.com`;
  const password = `E2E-${randomBytes(24).toString('base64url')}`;
  const passwordHash = await hashPassword(password);
  await db(
    'insert into better_auth."user" (id,name,email,email_verified,username,created_at,updated_at) values ($1,$2,$3,true,$4,now(),now())',
    [id, 'Referral Production E2E', email, username],
  );
  await db(
    'insert into better_auth.account (id,user_id,account_id,provider_id,issuer,password,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,now(),now())',
    [id, id, id, 'credential', 'local:credential', passwordHash],
  );
  await db(
    'insert into public.users (id,username,full_name,password_hash,role,permissions,is_active,created_at) values ($1,$2,$3,$4,$5,$6,true,now())',
    [id, username, 'Referral Production E2E', passwordHash, 'user', JSON.stringify([])],
  );
  await db(
    'insert into public.auth_identity_links (better_auth_user_id,application_user_id,source,created_at,updated_at) values ($1,$2,$3,now(),now())',
    [id, id, 'native'],
  );
  return { id, email, password };
}

async function cleanupUser({ betterAuthUserId, applicationUserId = betterAuthUserId }) {
  await db('delete from public.pay_referral_signup_email_deliveries where referrer_application_user_id = $1 or attribution_id in (select id from public.pay_referral_user_attributions where referred_user_id = $1)', [applicationUserId]);
  await db('delete from public.pay_referral_user_attributions where referred_user_id = $1 or affiliate_id in (select id from public.pay_affiliates where owner_user_id = $1)', [applicationUserId]);
  await db('delete from public.pay_referral_click_events where affiliate_id in (select id from public.pay_affiliates where owner_user_id = $1)', [applicationUserId]);
  await db('delete from public.pay_referrals where affiliate_id in (select id from public.pay_affiliates where owner_user_id = $1)', [applicationUserId]);
  await db('delete from public.pay_affiliates where owner_user_id = $1', [applicationUserId]);
  await db('delete from public.auth_identity_links where application_user_id = $1 or better_auth_user_id = $2', [applicationUserId, betterAuthUserId]);
  await db('delete from public.users where id = $1', [applicationUserId]);
  await db('delete from better_auth.account where user_id = $1', [betterAuthUserId]);
  await db('delete from better_auth."user" where id = $1', [betterAuthUserId]);
}

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

assert.ok(SUPABASE_ACCESS_TOKEN, 'SUPABASE_ACCESS_TOKEN is required');

const referrer = await provisionReferrer();
let referredBetterAuthUserId = '';
let referredApplicationUserId = '';
let browser;
let referrerContext;
let referredContext;
try {
  browser = await chromium.launch({ headless: true });
  referrerContext = await browser.newContext({
    baseURL: ORIGIN,
    viewport: { width: 1440, height: 900 },
    locale: 'fa-IR',
  });
  const referrerPage = await referrerContext.newPage();

  const signIn = await referrerContext.request.post('/api/auth/sign-in/email', {
    headers: { Origin: ORIGIN, Accept: 'application/json', 'Content-Type': 'application/json' },
    data: { email: referrer.email, password: referrer.password },
  });
  assert.equal(signIn.status(), 200, await signIn.text());

  const dashboardBeforeResponse = await referrerContext.request.get('/api/pay/v1/referrals?limit=100', {
    headers: { Origin: ORIGIN, Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });
  assert.equal(dashboardBeforeResponse.status(), 200, await dashboardBeforeResponse.text());
  const dashboardBefore = await dashboardBeforeResponse.json();
  const code = dashboardBefore.data?.affiliate?.referral_code;
  assert.match(code || '', /^sm_[0-9a-f]{12}$/i, 'Production must issue only the current short referral code.');
  const referralUrl = ORIGIN + '/r/' + code;

  const oldReferralUrl = ORIGIN + '/r/sm_4de455180bd6432fa8028c7093adacae';
  const oldResponse = await referrerContext.request.get(oldReferralUrl, { maxRedirects: 0, headers: { Accept: 'text/plain' } });
  assert.equal(oldResponse.status(), 404, 'Legacy long referral links must be invalid.');
  console.log('REFERRAL_LEGACY_LINK_REMOVED PASS');

  referredContext = await browser.newContext({
    baseURL: ORIGIN,
    viewport: { width: 390, height: 844 },
    locale: 'fa-IR',
  });
  const referredPage = await referredContext.newPage();

  const clickResponse = await referredPage.goto(referralUrl, { waitUntil: 'domcontentloaded' });
  assert.ok(clickResponse, 'Referral navigation must return a response.');
  assert.equal(clickResponse.status(), 200, 'Referral navigation must complete at the homepage after the tracked redirect.');
  const finalUrl = await referredPage.url();
  assert.equal(new URL(finalUrl).pathname, '/', 'Valid referral link must redirect to homepage.');
  assert.equal(new URL(finalUrl).origin, ORIGIN, 'Referral redirect must remain on the canonical production origin.');

  const cookies = await referredContext.cookies(finalUrl);
  const referralCookie = cookies.find((cookie) => cookie.name === 'solmint_referral_click');
  console.log('REFERRAL_COOKIE_SCOPE ' + JSON.stringify({
    origin: new URL(finalUrl).origin,
    domain: referralCookie?.domain || null,
    path: referralCookie?.path || null,
    secure: referralCookie?.secure ?? null,
    httpOnly: referralCookie?.httpOnly ?? null,
    sameSite: referralCookie?.sameSite || null,
  }));
  assert.ok(referralCookie, 'Referral attribution cookie must be stored.');
  assert.equal(referralCookie.httpOnly, true);
  assert.equal(referralCookie.sameSite, 'Lax');
  assert.ok(referralCookie.expires > Date.now() / 1000 + 60 * 60 * 24 * 29, 'Referral cookie must persist for approximately 30 days.');
  console.log('REFERRAL_CLICK_ROUTE_AND_COOKIE PASS ' + JSON.stringify({ code, homepage: true, cookiePersistent: true }));

  const username = `pay_ref_signup_${crypto.randomUUID().replaceAll('-', '').slice(0, 8)}`;
  const email = `${username}@example.com`;
  const password = `E2E-${randomBytes(24).toString('base64url')}`;

  const signupRequestCookiePromise = new Promise((resolve) => {
    const handler = async (request) => {
      const url = new URL(request.url());
      if (request.method() !== 'POST' || url.pathname !== '/api/auth/sign-up/email') return;
      try {
        const headers = await request.allHeaders();
        resolve(typeof headers.cookie === 'string' ? headers.cookie : '');
      } catch {
        resolve('');
      }
    };
    referredPage.on('request', handler);
  });

  const signupResult = await referredPage.evaluate(async ({ email, password, username }) => {
    const response = await fetch('/api/auth/sign-up/email', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Accept-Language': 'fa-IR',
      },
      body: JSON.stringify({
        email,
        name: 'Referral Production Referred',
        password,
        username,
      }),
    });
    return { status: response.status, text: await response.text() };
  }, { email, password, username });
  const signupBodyText = signupResult.text;
  assert.ok([200, 201].includes(signupResult.status), `Referral signup failed: HTTP ${signupResult.status} ${signupBodyText}`);
  let signupBody = {};
  try { signupBody = signupBodyText ? JSON.parse(signupBodyText) : {}; } catch {}
  referredBetterAuthUserId = String(signupBody?.user?.id || '');
  assert.ok(referredBetterAuthUserId.length >= 8, 'Better Auth signup must return a user id.');

  const signupCookieHeader = await Promise.race([
    signupRequestCookiePromise,
    new Promise((resolve) => setTimeout(() => resolve(''), 5000)),
  ]);
  const signupReferralCookiePresent =
    typeof signupCookieHeader === 'string' &&
    signupCookieHeader.split(';').some((part) => part.trim().startsWith('solmint_referral_click='));
  console.log('REFERRAL_SIGNUP_REQUEST_COOKIE ' + JSON.stringify({ sent: signupReferralCookiePresent }));
  assert.equal(
    signupReferralCookiePresent,
    true,
    'The real browser must send the HttpOnly referral cookie on the signup request.',
  );

  const identityRows = rows(await db(
    'select better_auth_user_id,application_user_id from public.auth_identity_links where better_auth_user_id = $1',
    [referredBetterAuthUserId],
    true,
  ));
  assert.equal(identityRows.length, 1, 'Signup must persist the Better Auth to application identity link.');
  assert.equal(identityRows[0].better_auth_user_id, referredBetterAuthUserId);
  referredApplicationUserId = String(identityRows[0].application_user_id || '');
  assert.match(referredApplicationUserId, /^usr-[0-9a-f-]{36}$/i, 'Application user id must use the server-issued usr-UUID identity.');

  const attributionRows = rows(await db(
    'select id,affiliate_id,referred_user_id,click_event_id,referral_code from public.pay_referral_user_attributions where referred_user_id = $1',
    [referredApplicationUserId],
    true,
  ));
  assert.equal(attributionRows.length, 1, 'Exactly one direct referral attribution must be persisted.');
  assert.equal(attributionRows[0].affiliate_id, dashboardBefore.data.affiliate.id);
  assert.equal(attributionRows[0].referral_code, code);

  const clickRows = rows(await db(
    'select id,affiliate_id,referral_code,consumed_at from public.pay_referral_click_events where id = $1',
    [attributionRows[0].click_event_id],
    true,
  ));
  assert.equal(clickRows.length, 1);
  assert.equal(clickRows[0].affiliate_id, dashboardBefore.data.affiliate.id);
  assert.equal(clickRows[0].referral_code, code);
  assert.ok(clickRows[0].consumed_at, 'The successful signup must consume the attribution click.');

  const dashboardAfterResponse = await referrerContext.request.get('/api/pay/v1/referrals?limit=100', {
    headers: { Origin: ORIGIN, Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });
  assert.equal(dashboardAfterResponse.status(), 200, await dashboardAfterResponse.text());
  const dashboardAfter = await dashboardAfterResponse.json();
  assert.equal(dashboardAfter.data.stats.clicks, '1');
  assert.equal(dashboardAfter.data.stats.directSignups, '1');
  assert.equal(dashboardAfter.data.stats.referredMerchants, '0');
  assert.equal(dashboardAfter.data.stats.activeReferredMerchants, '0');

  await referrerPage.goto(ORIGIN + '/pay/referrals', { waitUntil: 'domcontentloaded' });
  await referrerPage.locator('.pay-referrals-stats').waitFor({ state: 'visible', timeout: 10000 });
  const statsText = await referrerPage.locator('.pay-referrals-stats').innerText();
  const directSummary = await referrerPage.locator('.pay-referrals-direct-summary').innerText();
  assert.ok(/1/.test(statsText), 'Referral stats UI must expose the recorded counts.');
  assert.ok(/1/.test(directSummary), 'Direct referral UI must expose the attributed signup count.');
  console.log('REFERRAL_DASHBOARD_COUNTS_AND_UI PASS ' + JSON.stringify({
    clicks: dashboardAfter.data.stats.clicks,
    directSignups: dashboardAfter.data.stats.directSignups,
    uiStatsVisible: true,
  }));

  await referredContext.close();
  referredContext = null;
  await cleanupUser({
    betterAuthUserId: referredBetterAuthUserId,
    applicationUserId: referredApplicationUserId,
  });
  referredBetterAuthUserId = '';
  referredApplicationUserId = '';
  console.log('REFERRAL_PRODUCTION_LIFECYCLE_E2E PASS');
} finally {
  if (referredBetterAuthUserId) {
    await cleanupUser({
      betterAuthUserId: referredBetterAuthUserId,
      applicationUserId: referredApplicationUserId || undefined,
    }).catch(() => {});
  }
  await cleanupUser({ betterAuthUserId: referrer.id, applicationUserId: referrer.id }).catch(() => {});
  await browser?.close().catch(() => {});
}
