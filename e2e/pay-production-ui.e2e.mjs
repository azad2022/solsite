import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const ORIGIN = (process.env.SOLMINT_PAY_PRODUCTION_ORIGIN || 'https://solmint.ir').replace(/\/$/, '');
const SUPABASE_ACCESS_TOKEN = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const PROJECT_REF = 'nvopkbiedorfshwbmyhn';
const VIEWPORT = { width: 390, height: 844 };
const EVIDENCE_DIR = '/tmp/pay-ui-evidence';
mkdirSync(EVIDENCE_DIR, { recursive: true });

function formatAtomicForE2e(value, decimals) {
  const amount = BigInt(value);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error('Invalid public Payment Link decimals: ' + decimals);
  if (decimals === 0) return amount.toString();
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = (amount % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

async function openPaymentLinksView(page) {
  const switchButton = page.locator('.pay-billing-tabs button').filter({ hasText: /Payment links|لینک‌های پرداخت|روابط الدفع|Платёжные ссылки/i });
  await switchButton.waitFor({ state: 'visible', timeout: 10000 });
  await switchButton.click();
  await page.waitForFunction(() => {
    const button = Array.from(document.querySelectorAll('.pay-billing-tabs button'))
      .find((candidate) => /Payment links|لینک‌های پرداخت|روابط الدفع|Платёжные ссылки/i.test(candidate.textContent || ''));
    return button?.getAttribute('aria-selected') === 'true';
  }, null, { timeout: 10000 });
}

function rows(value) {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === 'object');
  if (!value || typeof value !== 'object') return [];
  const row = value;
  for (const key of ['rows', 'data', 'result']) {
    if (Array.isArray(row[key])) return rows(row[key]);
    if (row[key] && typeof row[key] === 'object') return rows(row[key]);
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

function encodeBase58(bytes) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = 0n;
  for (const byte of bytes) value = value * 256n + BigInt(byte);
  let out = '';
  while (value > 0n) {
    const rem = Number(value % 58n);
    out = alphabet[rem] + out;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    out = '1' + out;
  }
  return out || '1';
}

async function provision() {
  const betterAuthUserId = crypto.randomUUID();
  const username = `pay_browser_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const email = `${username}@solmint.invalid`;
  const password = `E2E-${randomBytes(24).toString('base64url')}`;
  const passwordHash = await hashPassword(password);
  await db(
    'insert into better_auth."user" (id,name,email,email_verified,username,created_at,updated_at) values ($1,$2,$3,true,$4,now(),now())',
    [betterAuthUserId, 'SolMint Pay Browser E2E', email, username],
  );
  await db(
    'insert into better_auth.account (id,user_id,account_id,provider_id,issuer,password,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,now(),now())',
    [betterAuthUserId, betterAuthUserId, betterAuthUserId, 'credential', 'local:credential', passwordHash],
  );
  await db(
    'insert into public.users (id,username,full_name,password_hash,role,permissions,is_active,created_at) values ($1,$2,$3,$4,$5,$6,true,now())',
    [betterAuthUserId, username, 'SolMint Pay Browser E2E', passwordHash, 'user', JSON.stringify([])],
  );
  await db(
    'insert into public.auth_identity_links (better_auth_user_id,application_user_id,source,created_at,updated_at) values ($1,$2,$3,now(),now())',
    [betterAuthUserId, betterAuthUserId, 'native'],
  );
  return { betterAuthUserId, applicationUserId: betterAuthUserId, email, password };
}

async function cleanup(fixture, merchantId) {
  if (merchantId) await db('delete from public.pay_payment_transactions where payment_id in (select id from public.pay_payment_intents where merchant_id = $1)', [merchantId]).catch(() => {});
  if (merchantId) await db('delete from public.pay_payment_intents where merchant_id = $1', [merchantId]).catch(() => {});
  if (merchantId) await db('delete from public.pay_payment_links where merchant_id = $1', [merchantId]).catch(() => {});
  if (merchantId) await db('delete from public.pay_invoices where merchant_id = $1', [merchantId]).catch(() => {});
  await db('delete from public.pay_merchant_members where merchant_id = $1', [merchantId]).catch(() => {});
  await db('delete from public.pay_merchants where id = $1', [merchantId]).catch(() => {});
  await db('delete from public.auth_identity_links where application_user_id = $1', [fixture.applicationUserId]).catch(() => {});
  await db('delete from public.users where id = $1', [fixture.applicationUserId]).catch(() => {});
  await db('delete from better_auth."user" where id = $1', [fixture.betterAuthUserId]).catch(() => {});
}

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function directSignIn(context, fixture) {
  const response = await context.request.post('/api/auth/sign-in/email', {
    headers: { Origin: ORIGIN, Accept: 'application/json', 'Content-Type': 'application/json' },
    data: { email: fixture.email, password: fixture.password },
  });
  assert.equal(response.status(), 200, `Browser fixture sign-in failed: ${response.status()}`);
  const body = await response.json();
  assert.ok(body.user, 'Better Auth sign-in must return user');
}

const routes = [
  ['/pay', 'overview'],
  ['/pay/merchants', 'merchants'],
  ['/pay/dashboard', 'dashboard'],
  ['/pay/transactions', 'transactions'],
  ['/pay/customers', 'customers'],
  ['/pay/invoices', 'invoices'],
  ['/pay/referrals', 'referrals'],
  ['/pay/reports', 'reports'],
  ['/pay/tickets', 'tickets'],
  ['/pay/developer', 'developer'],
  ['/pay/security', 'security'],
  ['/pay/webhooks', 'webhooks'],
];

async function routeAudit(page, path, label, evidenceDir, apiEvents, isExpectedApiError = () => false) {
  apiEvents.length = 0;
  const navigationStartedAt = Date.now();
  const response = await page.goto(`${ORIGIN}${path}`, { waitUntil: 'domcontentloaded' });
  assert.ok(response && response.ok(), `Navigation failed for ${path}: ${response?.status()}`);
  await page.locator('.pay-app-shell').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => document.body.innerText.trim().length > 80, null, { timeout: 10000 });
  const title = await page.title();
  const bodyText = await page.locator('body').innerText();
  assert.ok(!/404|یافت نشد|not found/i.test(title), `${path} must not serve a 404 document: ${title}`);
  assert.ok(bodyText.trim().length > 80, `${path} rendered too little content`);
  assert.equal(await page.locator('.pay-app-shell').count(), 1, `${path} must render the Pay shell`);
  const routeApiEvents = apiEvents.filter((event) => event.startedAt >= navigationStartedAt);
  const bad = routeApiEvents.filter((event) => event.status >= 400 && !isExpectedApiError(event));
  const expected = routeApiEvents.filter((event) => event.status >= 400 && isExpectedApiError(event));
  if (expected.length) console.log(`EXPECTED_PAY_API_ERRORS ${JSON.stringify({ path, expected })}`);
  if (bad.length) throw new Error(`${path} produced unexpected Pay API errors: ${JSON.stringify(bad)}`);
  await page.screenshot({ path: `${evidenceDir}/${label}.png`, fullPage: false });
  return { path, title, apiEvents: [...apiEvents], excerpt: bodyText.slice(0, 800) };
}

assert.ok(SUPABASE_ACCESS_TOKEN, 'SUPABASE_ACCESS_TOKEN is required');
const fixture = await provision();
let merchantId = '';
try {
  const browser = await chromium.launch({ headless: true });
  const guestContext = await browser.newContext({
    baseURL: ORIGIN,
    viewport: { width: 1440, height: 900 },
    locale: 'fa-IR',
  });
  const guestPage = await guestContext.newPage();
  guestPage.on('pageerror', (error) => console.log(`GUEST_PAGE_ERROR ${error.message}`));
  guestPage.on('console', (message) => {
    const type = message.type();
    if (type === 'error' || type === 'warning') console.log(`GUEST_CONSOLE_${type.toUpperCase()} ${message.text().slice(0, 2000)}`);
  });
  guestPage.on('requestfailed', (request) => console.log(`GUEST_REQUEST_FAILED ${JSON.stringify({
    url: request.url(),
    resourceType: request.resourceType(),
    failure: request.failure()?.errorText || null,
  })}`));
  guestPage.on('response', async (response) => {
    const request = response.request();
    if (request.resourceType() !== 'script') return;
    const contentType = response.headers()['content-type'] || '';
    if (response.status() >= 400 || !/javascript|ecmascript|wasm/i.test(contentType)) {
      console.log(`GUEST_SCRIPT_RESPONSE_DIAGNOSTIC ${JSON.stringify({ url: response.url(), status: response.status(), contentType })}`);
    }
  });
  await guestPage.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  const rootScriptDiagnostics = await guestPage.evaluate(() => Array.from(document.querySelectorAll('script[src]')).map((script) => ({
    src: script.src,
    type: script.getAttribute('type') || 'classic',
  })));
  console.log(`GUEST_ROOT_SCRIPT_DIAGNOSTICS ${JSON.stringify(rootScriptDiagnostics)}`);
  const guestHeader = guestPage.locator('[data-header-primary-nav]');
  try {
    await guestHeader.waitFor({ state: 'visible', timeout: 30000 });
  } catch (error) {
    await guestPage.screenshot({ path: `${EVIDENCE_DIR}/guest-header-timeout.png`, fullPage: false }).catch(() => {});
    const diagnostic = {
      url: await guestPage.url(),
      title: await guestPage.title(),
      bodyExcerpt: (await guestPage.locator('body').innerText().catch(() => '')).slice(0, 2000),
      headerCount: await guestHeader.count().catch(() => -1),
    };
    console.log(`GUEST_HEADER_PREFLIGHT_DIAGNOSTIC ${JSON.stringify(diagnostic)}`);
    throw error;
  }
  assert.equal(await guestHeader.locator('[data-nav-key]').count(), 6, 'Desktop primary header must expose exactly six destinations.');
  const guestLoginButton = guestPage.locator('header button[aria-label="ورود / ثبت‌نام"]:visible');
  await guestLoginButton.waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await guestLoginButton.count(), 1, 'Desktop header must expose exactly one visible login/register control.');
  await guestPage.getByRole('link', { name: 'درگاه پرداخت', exact: true }).waitFor({ state: 'visible', timeout: 10000 });
  await guestPage.getByRole('link', { name: 'درگاه پرداخت', exact: true }).click();
  assert.equal(new URL(await guestPage.url()).pathname, '/', 'Guest Pay navigation must not enter /pay.');
  const authDialog = guestPage.getByRole('dialog');
  await authDialog.waitFor({ state: 'visible', timeout: 10000 });
  await authDialog.getByRole('heading', { name: 'ورود به حساب', exact: true }).waitFor({ state: 'visible', timeout: 10000 });
  await authDialog.getByRole('button', { name: 'ساخت حساب جدید', exact: true }).click();
  await authDialog.getByRole('heading', { name: 'ایجاد حساب', exact: true }).waitFor({ state: 'visible', timeout: 10000 });
  await guestPage.locator('[aria-label="بستن پنجره ورود"]').click();

  // Public referral routing regression: an invalid referral must reach the dedicated Pages Function
  // instead of falling through to the SPA shell. This request is non-mutating.
  const invalidReferralCode = 'sm_test_nonexistent_' + crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  const invalidReferralResponse = await guestPage.goto(
    ORIGIN + '/r/' + invalidReferralCode,
    { waitUntil: 'domcontentloaded' },
  );
  assert.equal(
    invalidReferralResponse?.status(),
    404,
    'Invalid public referral code must be handled by the dedicated /r/* Function, not the SPA fallback.',
  );
  const invalidReferralBody = (await guestPage.locator('body').innerText()).trim();
  assert.equal(invalidReferralBody, 'Referral link not found.');
  console.log('REFERRAL_PUBLIC_ROUTE_NEGATIVE_E2E PASS');

  await guestPage.goto(ORIGIN + '/pay', { waitUntil: 'domcontentloaded' });
  await guestPage.waitForFunction(() => window.location.pathname === '/', { timeout: 10000 });
  assert.equal(new URL(await guestPage.url()).pathname, '/', 'Direct guest /pay navigation must return to the public site.');
  const directAuthDialog = guestPage.getByRole('dialog');
  await directAuthDialog.waitFor({ state: 'visible', timeout: 10000 });
  await directAuthDialog.getByRole('heading', { name: 'ورود به حساب', exact: true }).waitFor({ state: 'visible', timeout: 10000 });
  console.log('PAY_GUEST_NAVIGATION_GUARD_PRODUCTION_E2E PASS');
  await guestContext.close();

  const context = await browser.newContext({ baseURL: ORIGIN, viewport: VIEWPORT, locale: 'en-US' });
  const apiEvents = [];
  context.on('request', () => {});
  await directSignIn(context, fixture);

  const page = await context.newPage();
  // Desktop sidebar regression: the rail stays attached to the viewport, exposes its full navigation,
  // and follows the document writing direction instead of reversing the flex shell a second time.
  await page.setViewportSize({ width: 1440, height: 520 });
  for (const [targetLocale, expectedDirection, optionLabel] of [
    ['fa-IR', 'rtl', 'فارسی'],
    ['en-US', 'ltr', 'English'],
    ['ar', 'rtl', 'العربية'],
    ['ru', 'ltr', 'Русский'],
  ]) {
    await page.goto(ORIGIN + '/pay', { waitUntil: 'domcontentloaded' });
    const trigger = page.locator('.pay-language-trigger');
    await trigger.waitFor({ state: 'visible', timeout: 10000 });
    await trigger.click();
    await page.locator('.pay-language-option').filter({ hasText: optionLabel }).click();
    await page.waitForFunction((direction) => document.documentElement.getAttribute('dir') === direction, expectedDirection, { timeout: 10000 });

    const sidebar = page.locator('.pay-sidebar');
    await sidebar.waitFor({ state: 'visible', timeout: 10000 });
    const diagnostics = await sidebar.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        direction: element.getAttribute('dir'),
        position: style.position,
        overflowY: style.overflowY,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        x: rect.x,
        right: rect.right,
        width: rect.width,
      };
    });
    assert.equal(diagnostics.position, 'sticky', `Desktop sidebar must remain sticky for ${targetLocale}.`);
    assert.equal(diagnostics.overflowY, 'auto', `Desktop sidebar must have an internal vertical scroll for ${targetLocale}.`);
    assert.equal(diagnostics.direction, expectedDirection);
    assert.ok(diagnostics.scrollHeight >= diagnostics.clientHeight);

    const mainColumn = await page.locator('.pay-main-column').boundingBox();
    assert.ok(mainColumn);
    if (expectedDirection === 'rtl') {
      assert.ok(Math.abs(diagnostics.right - 1440) < 1, `RTL sidebar must attach to the right edge: ${JSON.stringify(diagnostics)}`);
      assert.ok((mainColumn?.x ?? 0) + (mainColumn?.width ?? 0) <= diagnostics.x + 1,
        `RTL main column must remain left of sidebar: ${JSON.stringify({ diagnostics, mainColumn })}`);
    } else {
      assert.ok(Math.abs(diagnostics.x) < 1, `LTR sidebar must attach to the left edge: ${JSON.stringify(diagnostics)}`);
      assert.ok((mainColumn?.x ?? 0) >= diagnostics.right - 1,
        `LTR main column must remain right of sidebar: ${JSON.stringify({ diagnostics, mainColumn })}`);
    }

    await sidebar.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    const iconDiagnostics = await sidebar.locator('.pay-nav-icon svg').evaluateAll((icons) => icons.map((icon) => {
      const rect = icon.getBoundingClientRect();
      const style = getComputedStyle(icon);
      return { width: rect.width, height: rect.height, visibility: style.visibility, opacity: style.opacity };
    }));
    assert.ok(iconDiagnostics.length >= 7, `Every primary navigation entry must retain a visible icon: ${JSON.stringify(iconDiagnostics)}`);
    assert.ok(iconDiagnostics.every((icon) => icon.width > 0 && icon.height > 0 && icon.visibility !== 'hidden' && Number(icon.opacity) > 0),
      `Sidebar icons must remain visible: ${JSON.stringify(iconDiagnostics)}`);
    const lastNav = page.locator('.pay-nav-item').last();
    const lastBox = await lastNav.boundingBox();
    assert.ok(lastBox, `Last navigation item must remain renderable for ${targetLocale}.`);
    assert.ok(lastBox.y >= -1 && lastBox.y + lastBox.height <= 520 + 1,
      `Last navigation item must be reachable inside the scrollable sidebar: ${JSON.stringify({ lastBox, diagnostics })}`);
  }
  await page.setViewportSize(VIEWPORT);

  page.on('console', (message) => {
    if (message.type() === 'error') console.log(`BROWSER_CONSOLE_ERROR ${message.text()}`);
  });

  const runtimeResponse = await page.goto(`${ORIGIN}/pay/merchants?__pay_runtime_probe=${encodeURIComponent(crypto.randomUUID())}`, { waitUntil: 'domcontentloaded' });
  assert.ok(runtimeResponse && runtimeResponse.ok(), `Authenticated Pay runtime navigation failed: ${runtimeResponse?.status()}`);
  await page.locator('[data-pay-runtime="transport-v2"]').waitFor({ state: 'attached', timeout: 10000 });
  assert.equal(await page.locator('[data-pay-runtime="transport-v2"]').count(), 1);
  assert.equal(await page.locator('.pay-app-shell').count(), 1);
  console.log(`AUTHENTICATED_PAY_RUNTIME_PROBE ${JSON.stringify({ status: runtimeResponse.status(), marker: 1, shell: 1 })}`);
  page.on('pageerror', (error) => {
    console.log(`BROWSER_PAGE_ERROR ${error.message}`);
  });
  const browserRequests = [];
  const apiRequestStartTimes = new WeakMap();
  page.on('request', (request) => {
    if (request.url().includes('/api/')) {
      apiRequestStartTimes.set(request, Date.now());
    }
    if (!request.url().includes('/api/')) return;
    browserRequests.push({ url: request.url(), method: request.method() });
  });
  page.on('response', async (response) => {
    if (!response.url().includes('/api/')) return;
    let body = '';
    if (response.status() >= 400) {
      try { body = (await response.text()).slice(0, 1000); } catch { body = ''; }
    }
    apiEvents.push({
      url: response.url(),
      status: response.status(),
      method: response.request().method(),
      body,
      startedAt: apiRequestStartTimes.get(response.request()) ?? Date.now(),
    });
  });

  const merchantPageResponse = await page.goto(`${ORIGIN}/pay/merchants`, { waitUntil: 'domcontentloaded' });

  const languageTrigger = page.locator('.pay-language-trigger');
  await languageTrigger.waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await page.locator('.pay-language-control').count(), 1, 'Pay language control must be compact and singular.');
  await languageTrigger.click();
  const languageMenu = page.locator('.pay-language-menu');
  await languageMenu.waitFor({ state: 'visible', timeout: 5000 });
  assert.equal(await languageMenu.locator('.pay-language-option').count(), 4, 'Pay selector must expose the four active locales.');
  assert.equal(await languageMenu.locator('.pay-language-flag').count(), 4, 'Every active locale must have a flag marker.');
  await languageMenu.locator('.pay-language-option').filter({ hasText: 'فارسی' }).click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'fa-IR');
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.waitForFunction(() => document.documentElement.getAttribute('lang') === 'fa-IR', null, { timeout: 10000 });
  assert.equal(await page.locator('html').getAttribute('lang'), 'fa-IR', 'Selected locale must survive a full page refresh.');
  await page.waitForFunction(() => document.documentElement.getAttribute('dir') === 'rtl', null, { timeout: 10000 });
  console.log('PAY_LANGUAGE_PERSISTENCE_E2E passed for fa-IR with compact flag dropdown.');

  await page.locator('.pay-language-trigger').click();
  await page.locator('.pay-language-menu').locator('.pay-language-option').filter({ hasText: 'English' }).click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en-US');
  assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');


  await page.waitForTimeout(1200);
  assert.ok(merchantPageResponse && merchantPageResponse.ok(), 'Production Merchant page must be reachable.');
  assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
  const runtimeMarkerCount = await page.locator('[data-pay-runtime="transport-v2"]').count();
  const documentDiagnostics = await page.evaluate(() => ({
    url: location.href,
    payRuntimeCount: document.querySelectorAll('[data-pay-runtime="transport-v2"]').length,
    scripts: Array.from(document.scripts).map(script => ({
      src: script.src,
      type: script.type,
      nonce: script.nonce || '',
      inlineLength: script.src ? 0 : script.textContent?.length ?? 0,
      inlinePreview: script.src ? '' : (script.textContent || '').trim().slice(0, 180),
    })),
    htmlStart: document.documentElement.outerHTML.slice(0, 3500),
  }));
  const contentSecurityPolicy = merchantPageResponse.headers()['content-security-policy'] || '';
  assert.match(contentSecurityPolicy, /script-src[^;]*'nonce-[^']+'/, 'Pay CSP must use a response-scoped script nonce.');
  const inlineScriptsMissingNonce = documentDiagnostics.scripts.filter((script) => script.inlineLength > 0 && !script.nonce);
  assert.equal(inlineScriptsMissingNonce.length, 0,
    `Pay inline scripts missing CSP nonce: ${JSON.stringify(inlineScriptsMissingNonce)}`);
  console.log(`PAY_RUNTIME_PROBE ${JSON.stringify({ runtimeMarkerCount, documentDiagnostics, headers: { cacheControl: merchantPageResponse.headers()['cache-control'] || '', etag: merchantPageResponse.headers()['etag'] || '', age: merchantPageResponse.headers()['age'] || '', cfCacheStatus: merchantPageResponse.headers()['cf-cache-status'] || '', cfRay: merchantPageResponse.headers()['cf-ray'] || '', server: merchantPageResponse.headers()['server'] || '', contentSecurityPolicy } })}`);
  if (runtimeMarkerCount !== 1) {
    const probeUrl = `${ORIGIN}/pay/merchants?__pay_runtime_probe=${encodeURIComponent(crypto.randomUUID())}`;
    const probeResponse = await page.goto(probeUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const probeDiagnostics = await page.evaluate(() => ({
      url: location.href,
      payRuntimeCount: document.querySelectorAll('[data-pay-runtime="transport-v2"]').length,
      scriptSrcs: Array.from(document.scripts).map(script => script.src).filter(Boolean),
      htmlStart: document.documentElement.outerHTML.slice(0, 1800),
    }));
    console.log(`PAY_RUNTIME_CACHE_BYPASS_PROBE ${JSON.stringify({ ok: Boolean(probeResponse?.ok()), status: probeResponse?.status(), diagnostics: probeDiagnostics, headers: { cacheControl: probeResponse?.headers()['cache-control'] || '', etag: probeResponse?.headers()['etag'] || '', age: probeResponse?.headers()['age'] || '', cfCacheStatus: probeResponse?.headers()['cf-cache-status'] || '', cfRay: probeResponse?.headers()['cf-ray'] || '', server: probeResponse?.headers()['server'] || '' } })}`);
  }
  assert.equal(runtimeMarkerCount, 1, 'Production must serve the current Pay runtime bundle.');
  const directMerchantApi = await page.evaluate(async () => {
    try {
      const response = await fetch('/api/pay/v1/merchants', { credentials: 'include', cache: 'no-store' });
      return { status: response.status, body: (await response.text()).slice(0, 1200) };
    } catch (error) {
      return { status: 0, body: error instanceof Error ? error.message : String(error) };
    }
  });
  const perfPayRequests = await page.evaluate(() =>
    performance.getEntriesByType('resource')
      .map(entry => entry.name)
      .filter(name => name.includes('/api/pay/'))
  );
  console.log(`DIRECT_MERCHANT_API ${JSON.stringify({ directMerchantApi, perfPayRequests })}`);

  const onboardingForm = page.locator('.pay-onboarding-form');
  await onboardingForm.waitFor({ state: 'visible', timeout: 10000 });

  const formDiagnosticsBefore = await onboardingForm.locator('input').evaluateAll((inputs) =>
    inputs.map((input) => ({
      name: input.name,
      value: input.value,
      placeholder: input.getAttribute('placeholder') || '',
      disabled: input.disabled,
      required: input.required,
      type: input.type,
    }))
  );
  const createButton = onboardingForm.locator('.pay-primary-action');
  const buttonBefore = await createButton.evaluate((button) => ({
    text: button.textContent?.trim() || '',
    disabled: button.disabled,
    type: button.getAttribute('type'),
    ariaDisabled: button.getAttribute('aria-disabled'),
  }));
  console.log(`MERCHANT_FORM_BEFORE ${JSON.stringify({ formDiagnosticsBefore, buttonBefore })}`);

  await onboardingForm.locator('input').nth(0).fill('SolMint Browser Test Merchant');
  const browserTestSlug = `solmint-browser-test-${crypto.randomUUID().slice(0, 8).toLowerCase()}`;
  await onboardingForm.locator('input').nth(1).fill(browserTestSlug);
  await page.waitForTimeout(100);
  const formDiagnosticsAfterFill = await onboardingForm.locator('input').evaluateAll((inputs) =>
    inputs.map((input) => ({ name: input.name, value: input.value, disabled: input.disabled, required: input.required, type: input.type }))
  );
  console.log(`MERCHANT_FORM_AFTER_FILL ${JSON.stringify(formDiagnosticsAfterFill)}`);

  const merchantPost = (request) =>
    request.url().endsWith('/api/pay/v1/merchants') && request.method() === 'POST';
  const createRequestPromise = page.waitForRequest(merchantPost, { timeout: 10000 });
  const createResponsePromise = page.waitForResponse((response) => merchantPost(response.request()), { timeout: 15000 });

  await createButton.click();

  let createRequest;
  try {
    createRequest = await createRequestPromise;
  } catch (error) {
    const diagnostics = {
      stageText: await page.locator('.pay-onboarding-progress').allTextContents(),
      formVisible: await onboardingForm.isVisible().catch(() => false),
      formDiagnosticsAfterClick: await onboardingForm.locator('input').evaluateAll((inputs) =>
        inputs.map((input) => ({ name: input.name, value: input.value, disabled: input.disabled, type: input.type }))
      ).catch(() => []),
      buttonAfterClick: await createButton.evaluate((button) => ({
        text: button.textContent?.trim() || '', disabled: button.disabled, type: button.getAttribute('type'),
      })).catch(() => null),
      apiEvents,
      browserRequests,
      bodyExcerpt: (await page.locator('body').innerText()).slice(0, 2500),
    };
    await page.screenshot({ path: `${EVIDENCE_DIR}/merchant-create-no-request.png`, fullPage: false });
    console.log(`MERCHANT_CREATE_NO_REQUEST ${JSON.stringify(diagnostics)}`);
    throw error;
  }

  console.log(`MERCHANT_CREATE_REQUEST ${JSON.stringify({ url: createRequest.url(), method: createRequest.method() })}`);

  let createResponse;
  try {
    createResponse = await createResponsePromise;
  } catch (error) {
    await page.screenshot({ path: `${EVIDENCE_DIR}/merchant-create-no-response.png`, fullPage: false });
    console.log(`MERCHANT_CREATE_NO_RESPONSE ${JSON.stringify({
      request: { url: createRequest.url(), method: createRequest.method() },
      apiEvents,
      browserRequests,
      bodyExcerpt: (await page.locator('body').innerText()).slice(0, 2500),
    })}`);
    throw error;
  }
  assert.equal(createResponse.status(), 201, await createResponse.text());
  const createBody = await createResponse.json();
  merchantId = createBody.merchant.id;
  await page.getByText('SolMint Browser Test Merchant', { exact: true }).first().waitFor({ state: 'visible', timeout: 10000 });

  await page.goto(ORIGIN + '/pay/merchants', { waitUntil: 'domcontentloaded' });
  await page.locator('.pay-onboarding-wallet').waitFor({ state: 'visible', timeout: 10000 });
  const preVerificationWalletText = (await page.locator('.pay-onboarding-wallet').innerText()).replace(/\s+/g, ' ').trim();
  const dedicatedWalletAction = page.getByRole('button', { name: /Create dedicated SolMint wallet|ایجاد کیف پول اختصاصی SolMint|إنشاء محفظة SolMint مخصصة|Создать выделенный кошелёк SolMint/i });
  const existingWalletAction = page.getByRole('button', { name: /Use existing wallet|استفاده از کیف پول موجود|استخدام محفظة موجودة|Использовать существующий кошелёк/i });
  await dedicatedWalletAction.waitFor({ state: 'visible', timeout: 10000 });
  await existingWalletAction.waitFor({ state: 'visible', timeout: 10000 });
  assert.match(preVerificationWalletText, /Not verified yet|کیف پول دریافت هنوز تأیید نشده است|لم يتم التحقق|Пока не подтверждён/i);
  console.log('MERCHANT_WALLET_VERIFICATION_UI_BEFORE ' + JSON.stringify({ dedicatedActionVisible: true, existingWalletFallbackVisible: true, walletText: preVerificationWalletText.slice(0, 600) }));

  const sensitiveWalletPostBodies = [];
  const sensitiveWalletRequests = [];
  const onSensitiveWalletRequest = (request) => {
    if (request.method() !== 'POST' || !request.url().includes('/api/pay/v1/merchants/') || !request.url().includes('/wallet-challenges')) return;
    sensitiveWalletRequests.push(request.url());
    sensitiveWalletPostBodies.push(request.postData() || '');
  };
  page.on('request', onSensitiveWalletRequest);

  await dedicatedWalletAction.click();
  await page.locator('.pay-onboarding-recovery').waitFor({ state: 'visible', timeout: 10000 });
  const maskedRecoveryWords = await page.locator('.pay-recovery-masked span').allTextContents();
  assert.equal(maskedRecoveryWords.length, 24, 'Default dedicated wallet recovery phrase must render 24 masked items.');
  assert.ok(maskedRecoveryWords.every((value) => value === '****'), 'Recovery phrase must be masked in the DOM.');
  const generatedAddress = (await page.locator('.pay-onboarding-generated-address code').innerText()).trim();
  assert.match(generatedAddress, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  await page.evaluate(() => {
    let captured = '';
    Object.defineProperty(window, '__solmintCapturedRecoveryPhrase', {
      configurable: true,
      get: () => captured,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value) => { captured = String(value); } },
    });
  });
  await page.getByRole('button', { name: 'Copy recovery phrase', exact: true }).click();
  const recoveryPhrase = await page.evaluate(() => window.__solmintCapturedRecoveryPhrase || '');
  assert.equal(recoveryPhrase.split(/\s+/).length, 24, 'Copy must place the complete recovery phrase on the clipboard.');
  const bodyTextAfterCopy = await page.locator('body').innerText();
  assert.equal(bodyTextAfterCopy.includes(recoveryPhrase), false, 'The exact recovery phrase must not become visible in the DOM.');
  assert.equal(await page.locator('.pay-recovery-confirm input[type="checkbox"]').isChecked(), false);
  assert.equal(await page.getByRole('button', { name: 'Continue and register wallet', exact: true }).isDisabled(), true);
  assert.equal(await page.locator('body').evaluate((body) => body.innerText.includes('Private key'),), false,
    'Recovery UI must not expose private-key copy/export controls.');

  await page.locator('.pay-recovery-confirm input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Continue and register wallet', exact: true }).click();
  await page.locator('.pay-onboarding-verified').waitFor({ state: 'visible', timeout: 15000 });
  page.off('request', onSensitiveWalletRequest);

  assert.ok(sensitiveWalletRequests.some((url) => /\/wallet-challenges$/.test(new URL(url).pathname)),
    'Dedicated wallet flow must issue the existing wallet challenge endpoint.');
  const challengeBodies = sensitiveWalletPostBodies.map((body) => JSON.parse(body));
  assert.deepEqual(Object.keys(challengeBodies.find((body) => Object.keys(body).length === 1 && 'walletAddress' in body) || {}).sort(), ['walletAddress']);
  assert.ok(challengeBodies.every((body) => !body.mnemonic && !body.seed && !body.seedPhrase && !body.privateKey),
    'Wallet secrets must never be present in wallet API request bodies.');
  assert.ok(sensitiveWalletPostBodies.every((body) => !body.includes(recoveryPhrase)),
    'The exact recovery phrase must never appear in wallet API request bodies.');

  const walletAfterGenerated = await page.evaluate(async (address) => {
    const response = await fetch('/api/pay/v1/merchants', { credentials: 'include', cache: 'no-store' });
    const text = (await response.text()).slice(0, 3000);
    let body = null;
    try { body = JSON.parse(text); } catch {}
    return {
      status: response.status,
      merchantStatus: body?.merchant?.status ?? null,
      walletAddress: body?.merchant?.receiving_wallet?.address ?? null,
      walletVerificationStatus: body?.merchant?.receiving_wallet?.verification_status ?? null,
      addressMatches: body?.merchant?.receiving_wallet?.address === address,
    };
  }, generatedAddress);
  assert.equal(walletAfterGenerated.status, 200);
  assert.equal(walletAfterGenerated.merchantStatus, 'active');
  assert.equal(walletAfterGenerated.walletVerificationStatus, 'verified');
  assert.equal(walletAfterGenerated.addressMatches, true);
  console.log('DEDICATED_MERCHANT_WALLET_GENERATION_PRODUCTION_E2E ' + JSON.stringify({
    phraseWordCount: 24,
    addressStored: true,
    requestBodiesRedacted: true,
    authoritativeStatus: walletAfterGenerated.walletVerificationStatus,
  }));

  await page.goto(ORIGIN + '/pay/merchants', { waitUntil: 'domcontentloaded' });
  const accountTrigger = page.locator('.pay-account-trigger');
  await accountTrigger.waitFor({ state: 'visible', timeout: 10000 });
  const walletBalanceResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/pay/v1/merchants/') &&
    response.url().endsWith('/wallet-balance') &&
    response.request().method() === 'GET',
    { timeout: 15000 },
  );
  await accountTrigger.click();
  const accountMenu = page.locator('.pay-account-menu');
  await accountMenu.waitFor({ state: 'visible', timeout: 10000 });
  const walletBalanceResponse = await walletBalanceResponsePromise;
  const walletBalanceText = await walletBalanceResponse.text();
  assert.equal(walletBalanceResponse.status(), 200, walletBalanceText);
  const walletBalanceBody = walletBalanceText ? JSON.parse(walletBalanceText) : {};
  const walletBalanceData = walletBalanceBody?.data;
  assert.equal(walletBalanceData?.walletAddress, generatedAddress);
  assert.equal(walletBalanceData?.network, 'solana-mainnet');
  assert.deepEqual(
    walletBalanceData?.assets?.map((asset) => asset.asset).sort(),
    ['SOL', 'USDC', 'USDT'],
  );
  for (const asset of walletBalanceData.assets) assert.match(String(asset.balanceAtomic), /^\d+$/);
  const accountMenuText = await accountMenu.innerText();
  assert.ok(accountMenuText.includes('SOL') && accountMenuText.includes('USDT') && accountMenuText.includes('USDC'));
  assert.equal(accountMenuText.includes('sk_pay_'), false);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('.pay-account-menu') === null, null, { timeout: 5000 });

  for (const [targetLocale, expectedDirection, optionLabel] of [
    ['fa-IR', 'rtl', 'فارسی'],
    ['en-US', 'ltr', 'English'],
    ['ar', 'rtl', 'العربية'],
    ['ru', 'ltr', 'Русский'],
  ]) {
    await page.goto(ORIGIN + '/pay/tickets', { waitUntil: 'domcontentloaded' });
    const training = page.locator('.pay-training');
    await training.waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await training.locator('details.pay-training-topic').count(), 12, 'Training Center must expose all 12 documented topics.');
    const firstTopic = training.locator('details.pay-training-topic').first();
    const firstSummary = firstTopic.locator('summary');
    await firstSummary.click();
    assert.equal(await firstTopic.getAttribute('open'), null, 'Training Center topic must collapse when its summary is clicked.');
    await firstSummary.click();
    assert.equal(await firstTopic.getAttribute('open'), '', 'Training Center topic must reopen from its summary interaction.');
    await firstTopic.locator('.pay-training-topic-body').waitFor({ state: 'visible', timeout: 5000 });
    const trainingNode = await training.elementHandle();
    const ticketNode = await page.locator('.pay-ticket-heading').first().elementHandle();
    assert.ok(trainingNode && ticketNode);
    const trainingBeforeTicket = await page.evaluate(([a, b]) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING), [trainingNode, ticketNode]);
    assert.equal(trainingBeforeTicket, true);
    await page.locator('.pay-language-trigger').click();
    await page.locator('.pay-language-option').filter({ hasText: optionLabel }).click();
    await page.waitForFunction((direction) => document.documentElement.getAttribute('dir') === direction, expectedDirection, { timeout: 10000 });
    assert.equal(await page.locator('html').getAttribute('lang'), targetLocale);
    await page.locator('.pay-training').getByRole('heading', { level: 2 }).waitFor({ state: 'visible', timeout: 5000 });
  }

  const preWalletRouteResults = [];
  for (const [path, label] of routes) {
    preWalletRouteResults.push(await routeAudit(
      page,
      path,
      `prewallet-${label}`,
      '/tmp/pay-ui-evidence',
      apiEvents,
      (event) => merchantId.length > 0
        && event.status === 403
        && new URL(event.url).pathname === `/api/pay/v1/merchants/${merchantId}/api-keys`
        && label === 'overview',
    ));
  }
  console.log(`PREWALLET_ROUTE_AUDIT ${JSON.stringify({ routeCount: preWalletRouteResults.length, paths: preWalletRouteResults.map(result => result.path) })}`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  const walletDomSnapshot = await page.evaluate(() => ({
    text: document.body.innerText.slice(0, 3200),
    walletCards: Array.from(document.querySelectorAll('.pay-onboarding-wallet')).map((node) => node.textContent?.trim() || ''),
    merchantStates: Array.from(document.querySelectorAll('.pay-onboarding-success')).map((node) => node.textContent?.trim() || ''),
  }));
  const merchantAfterVerify = await page.evaluate(async () => {
    const response = await fetch('/api/pay/v1/merchants', { credentials: 'include', cache: 'no-store' });
    return { status: response.status, body: (await response.text()).slice(0, 2200) };
  });
  console.log(`WALLET_STATE_DIAGNOSTICS ${JSON.stringify({ walletDomSnapshot, merchantAfterVerify })}`);
  const authoritativeAfterVerify = await context.request.get('/api/pay/v1/merchants', {
    headers: { Origin: ORIGIN, Accept: 'application/json', 'Cache-Control': 'no-cache' },
  });
  const authoritativeAfterVerifyText = await authoritativeAfterVerify.text();
  let databaseWalletState;
  try {
    databaseWalletState = rows(await db(
      `select w.merchant_id, w.wallet_role, w.verification_status, w.is_active
         from public.pay_merchant_wallets w
        where w.merchant_id = $1
          and w.wallet_role = 'receiving'
        order by w.verified_at desc nulls last`,
      [merchantId],
      true,
    ));
  } catch (error) {
    databaseWalletState = { error: error instanceof Error ? error.message : String(error) };
  }
  console.log(`WALLET_AUTHORITATIVE_AFTER_VERIFY ${JSON.stringify({
    dedicatedWalletVerification: {
      status: walletAfterGenerated.status,
      verified: walletAfterGenerated.walletVerificationStatus === 'verified',
      addressMatches: walletAfterGenerated.addressMatches,
    },
    api: { status: authoritativeAfterVerify.status, body: authoritativeAfterVerifyText.slice(0, 3000) },
    databaseWalletState,
  })}`);

  await page.goto(`${ORIGIN}/pay/merchants`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pay-api-keys', { state: 'visible', timeout: 10000 });
  await page.locator('.pay-onboarding-wallet').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.pay-onboarding-verified').waitFor({ state: 'visible', timeout: 10000 });
  const verifiedWalletUiText = (await page.locator('.pay-onboarding-wallet').innerText()).replace(/\s+/g, ' ').trim();
  assert.match(verifiedWalletUiText, new RegExp(generatedAddress.slice(0, 8)));
  console.log('MERCHANT_WALLET_VERIFICATION_UI_AFTER ' + JSON.stringify({ verifiedVisible: true, walletText: verifiedWalletUiText.slice(0, 600) }));
  const walletAfterReload = await page.evaluate(async (addressPrefix) => {
    const response = await fetch('/api/pay/v1/merchants', { credentials: 'include', cache: 'no-store' });
    const text = (await response.text()).slice(0, 3000);
    let body = null;
    try { body = JSON.parse(text); } catch {}
    return {
      status: response.status,
      text,
      merchantStatus: body?.merchant?.status ?? null,
      walletAddress: body?.merchant?.receiving_wallet?.address ?? null,
      walletVerificationStatus: body?.merchant?.receiving_wallet?.verification_status ?? null,
      addressMatches: typeof body?.merchant?.receiving_wallet?.address === 'string'
        && body.merchant.receiving_wallet.address.startsWith(addressPrefix),
    };
  }, generatedAddress.slice(0, 8));
  console.log(`WALLET_AFTER_RELOAD ${JSON.stringify(walletAfterReload)}`);
  assert.equal(walletAfterReload.status, 200, `Authoritative merchant GET after reload failed: ${walletAfterReload.text}`);
  assert.equal(walletAfterReload.merchantStatus, 'active',
    `Merchant must remain active after reload: ${walletAfterReload.text}`);
  assert.equal(walletAfterReload.walletVerificationStatus, 'verified',
    `Verified wallet must survive reload: ${walletAfterReload.text}`);
  assert.equal(walletAfterReload.addressMatches, true,
    `Authoritative wallet address changed after reload: ${walletAfterReload.text}`);

  await page.goto(ORIGIN + '/pay/invoices', { waitUntil: 'domcontentloaded' });
  await page.locator('.pay-invoice-create').waitFor({ state: 'visible', timeout: 10000 });
  const invoiceNumber = `E2E-${Date.now()}`;
  const invoiceForm = page.locator('.pay-invoice-create');
  await invoiceForm.locator('input').nth(0).fill(invoiceNumber);
  await invoiceForm.locator('input').nth(1).fill('Browser E2E Invoice');
  await invoiceForm.locator('input').nth(2).fill('E2E Customer');
  await invoiceForm.locator('input').nth(3).fill('1000000');
  await invoiceForm.locator('select').nth(0).selectOption('USDC');
  await invoiceForm.locator('select').nth(1).selectOption('merchant');
  await invoiceForm.locator('select').nth(2).selectOption('en-US');

  const invoicePost = (request) =>
    request.url().endsWith('/api/pay/v1/invoices') && request.method() === 'POST';
  const invoiceResponsePromise = page.waitForResponse(
    (response) => invoicePost(response.request()),
    { timeout: 15000 },
  );
  await invoiceForm.locator('.pay-primary-action').click();
  const invoiceResponse = await invoiceResponsePromise;
  const invoiceResponseText = await invoiceResponse.text();
  assert.equal(invoiceResponse.status(), 201, invoiceResponseText);
  const invoiceBody = invoiceResponseText ? JSON.parse(invoiceResponseText) : {};
  assert.equal(invoiceBody.apiVersion, 'v1');
  assert.equal(invoiceBody.data?.merchant_id, merchantId);
  assert.equal(invoiceBody.data?.invoice_number, invoiceNumber);
  assert.equal(invoiceBody.data?.status, 'open');
  assert.equal(invoiceBody.data?.amount_atomic, '1000000');
  assert.equal(invoiceBody.data?.asset, 'USDC');

  const invoiceFromDb = rows(await db(
    `select id, merchant_id, invoice_number, amount_atomic::text as amount_atomic, asset, status
       from public.pay_invoices
      where merchant_id = $1 and invoice_number = $2`,
    [merchantId, invoiceNumber],
    true,
  ));
  assert.equal(invoiceFromDb.length, 1, 'Created invoice must exist in the production database.');
  assert.equal(invoiceFromDb[0].merchant_id, merchantId);
  assert.equal(invoiceFromDb[0].amount_atomic, '1000000');
  assert.equal(invoiceFromDb[0].asset, 'USDC');
  assert.equal(invoiceFromDb[0].status, 'open');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.pay-invoices-table-wrap').waitFor({ state: 'visible', timeout: 10000 });
  const invoiceUiText = await page.locator('.pay-invoices-table-wrap').innerText();
  assert.ok(invoiceUiText.includes(invoiceNumber), 'Created invoice must be visible in the Invoice UI after reload.');
  console.log(`INVOICE_CREATE_PRODUCTION_E2E ${JSON.stringify({
    status: invoiceResponse.status(),
    invoiceId: invoiceBody.data?.id,
    merchantId,
    invoiceNumber,
    amountAtomic: invoiceBody.data?.amount_atomic,
    asset: invoiceBody.data?.asset,
    statusValue: invoiceBody.data?.status,
  })}`);

  await page.goto(ORIGIN + '/pay', { waitUntil: 'domcontentloaded' });
  await page.getByText('SolMint Browser Test Merchant', { exact: true }).first().waitFor({ state: 'visible', timeout: 10000 });
  const overviewTextAfterReload = await page.locator('body').innerText();
  assert.ok(overviewTextAfterReload.includes('SolMint Browser Test Merchant'),
    'Overview must render the authoritative merchant data after reload.');
  assert.equal(await page.locator('.pay-getting-started').count(), 0,
    'Completed onboarding must not keep the Getting Started guide visible on Overview.');

  await page.goto(ORIGIN + '/pay/invoices', { waitUntil: 'domcontentloaded' });
  await openPaymentLinksView(page);
  await page.locator('.pay-payment-link-create').waitFor({ state: 'visible', timeout: 10000 });
  const paymentLinkSlug = 'e2e-' + crypto.randomUUID().replaceAll('-', '').slice(0, 18).toLowerCase();
  const paymentLinkForm = page.locator('.pay-payment-link-create');
  await paymentLinkForm.locator('input').nth(0).fill(paymentLinkSlug);
  await paymentLinkForm.locator('input').nth(1).fill('Browser E2E Payment Link');
  await paymentLinkForm.locator('input').nth(2).fill('2000000');
  await paymentLinkForm.locator('select').nth(0).selectOption('USDC');
  await paymentLinkForm.locator('select').nth(1).selectOption('merchant');
  await paymentLinkForm.locator('select').nth(2).selectOption('en-US');
  await paymentLinkForm.locator('textarea').fill('Reusable fixed payment link for production E2E.');

  const paymentLinkPost = (request) =>
    request.url().endsWith('/api/pay/v1/payment-links') && request.method() === 'POST';
  const paymentLinkResponsePromise = page.waitForResponse(
    (response) => paymentLinkPost(response.request()),
    { timeout: 15000 },
  );
  await paymentLinkForm.locator('.pay-primary-action').click();
  const paymentLinkResponse = await paymentLinkResponsePromise;
  const paymentLinkResponseText = await paymentLinkResponse.text();
  assert.equal(paymentLinkResponse.status(), 201, paymentLinkResponseText);
  const paymentLinkBody = paymentLinkResponseText ? JSON.parse(paymentLinkResponseText) : {};
  assert.equal(paymentLinkBody.apiVersion, 'v1');
  assert.equal(paymentLinkBody.data?.merchant_id, merchantId);
  assert.equal(paymentLinkBody.data?.slug, paymentLinkSlug);
  assert.equal(paymentLinkBody.data?.fixed_amount_atomic, '2000000');
  assert.equal(paymentLinkBody.data?.asset, 'USDC');
  assert.equal(paymentLinkBody.data?.is_active, true);

  const linkFromDb = rows(await db(
    `select id, merchant_id, slug, description, fixed_amount_atomic::text as fixed_amount_atomic, asset, fee_payer, is_active
       from public.pay_payment_links
      where merchant_id = $1 and slug = $2`,
    [merchantId, paymentLinkSlug],
    true,
  ));
  assert.equal(linkFromDb.length, 1, 'Created payment link must exist in the production database.');
  assert.equal(linkFromDb[0].merchant_id, merchantId);
  assert.equal(linkFromDb[0].description, 'Reusable fixed payment link for production E2E.');
  assert.equal(linkFromDb[0].fixed_amount_atomic, '2000000');
  assert.equal(linkFromDb[0].asset, 'USDC');
  assert.equal(linkFromDb[0].is_active, true);

  await page.locator('.pay-payment-links-table').waitFor({ state: 'visible', timeout: 10000 });
  const createdLinkRow = page.locator('.pay-payment-links-table tbody tr').filter({ hasText: paymentLinkSlug });
  await createdLinkRow.locator('.pay-payment-links-actions .pay-icon-button').nth(1).click();
  await page.locator('.pay-payment-link-detail').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.pay-payment-link-detail .pay-primary-action').filter({ hasText: /Edit|ویرایش|تعديل|Изменить/i }).click();
  const editTitleInput = page.locator('.pay-payment-link-edit input').nth(1);
  await editTitleInput.fill('Browser E2E Payment Link Updated');
  const paymentLinkPatchResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/pay/v1/payment-links?merchantId=') &&
    response.url().includes('&linkId=') &&
    response.request().method() === 'PATCH'
  );
  await page.locator('.pay-payment-link-edit .pay-primary-action').click();
  const paymentLinkPatchResponse = await paymentLinkPatchResponsePromise;
  const paymentLinkPatchText = await paymentLinkPatchResponse.text();
  assert.equal(paymentLinkPatchResponse.status(), 200, paymentLinkPatchText);
  const paymentLinkPatchBody = paymentLinkPatchText ? JSON.parse(paymentLinkPatchText) : {};
  assert.equal(paymentLinkPatchBody.apiVersion, 'v1');
  assert.equal(paymentLinkPatchBody.data?.id, linkFromDb[0].id);
  assert.equal(paymentLinkPatchBody.data?.title, 'Browser E2E Payment Link Updated');

  const updatedLinkFromDb = rows(await db(
    `select id, title, slug, is_active
       from public.pay_payment_links
      where id = $1`,
    [linkFromDb[0].id],
    true,
  ));
  assert.equal(updatedLinkFromDb.length, 1);
  assert.equal(updatedLinkFromDb[0].title, 'Browser E2E Payment Link Updated');
  assert.equal(updatedLinkFromDb[0].is_active, true);
  console.log(`PAYMENT_LINK_UPDATE_PRODUCTION_E2E ${JSON.stringify({
    status: paymentLinkPatchResponse.status(),
    paymentLinkId: linkFromDb[0].id,
    title: paymentLinkPatchBody.data?.title,
    slug: paymentLinkPatchBody.data?.slug,
  })}`);

  const disposableLinkSlug = 'e2e-del-' + crypto.randomUUID().replaceAll('-', '').slice(0, 16).toLowerCase();
  await page.goto(ORIGIN + '/pay/invoices', { waitUntil: 'domcontentloaded' });
  await openPaymentLinksView(page);
  const disposableForm = page.locator('.pay-payment-link-create');
  await disposableForm.locator('input').nth(0).fill(disposableLinkSlug);
  await disposableForm.locator('input').nth(1).fill('Disposable Browser E2E Link');
  await disposableForm.locator('input').nth(2).fill('1000000');
  await disposableForm.locator('select').nth(0).selectOption('USDC');
  await disposableForm.locator('select').nth(1).selectOption('merchant');
  await disposableForm.locator('select').nth(2).selectOption('en-US');
  const disposableCreateResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/pay/v1/payment-links') && response.request().method() === 'POST'
  );
  await disposableForm.locator('.pay-primary-action').click();
  const disposableCreateResponse = await disposableCreateResponsePromise;
  const disposableCreateBodyText = await disposableCreateResponse.text();
  assert.equal(disposableCreateResponse.status(), 201, disposableCreateBodyText);
  const disposableCreateBody = disposableCreateBodyText ? JSON.parse(disposableCreateBodyText) : {};
  const disposableId = disposableCreateBody.data?.id;
  assert.equal(typeof disposableId, 'string');

  const disposableRow = page.locator('.pay-payment-links-table tbody tr').filter({ hasText: disposableLinkSlug });
  await disposableRow.locator('.pay-payment-links-actions .pay-icon-button').nth(1).click();
  await page.locator('.pay-payment-link-detail').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.pay-payment-link-detail .pay-secondary-action').filter({ hasText: /Delete link|حذف لینک|حذف الرابط|Удалить ссылку/i }).click();
  const disposableDeleteResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/pay/v1/payment-links?merchantId=') &&
    response.url().includes('&linkId=') &&
    response.request().method() === 'DELETE'
  );
  await page.locator('.pay-payment-link-detail .pay-primary-action').filter({ hasText: /Delete permanently|حذف نهایی|حذف نهائي|Удалить навсегда/i }).click();
  const disposableDeleteResponse = await disposableDeleteResponsePromise;
  const disposableDeleteText = await disposableDeleteResponse.text();
  assert.equal(disposableDeleteResponse.status(), 200, disposableDeleteText);
  await page.locator('.pay-payment-link-detail').waitFor({ state: 'hidden', timeout: 10000 });
  assert.equal((await page.locator('.pay-payment-links-table tbody tr').filter({ hasText: disposableLinkSlug }).count()), 0);
  const deletedLinkFromDb = rows(await db(
    `select id from public.pay_payment_links where id = $1`,
    [disposableId],
    true,
  ));
  assert.equal(deletedLinkFromDb.length, 0, 'A payment link without payment history must be deletable.');

  const paymentLinkUrl = `${ORIGIN}/pay/link/${encodeURIComponent(paymentLinkSlug)}`;
  const publicContext = await browser.newContext({ baseURL: ORIGIN, viewport: VIEWPORT, locale: 'en-US' });
  const publicPage = await publicContext.newPage();
  const publicLinkApiPromise = publicPage.waitForResponse(
    (response) => response.url().endsWith('/api/pay/v1/payment-links/' + encodeURIComponent(paymentLinkSlug))
      && response.request().method() === 'GET',
    { timeout: 15000 },
  );
  const publicResponse = await publicPage.goto(paymentLinkUrl, { waitUntil: 'domcontentloaded' });
  assert.ok(publicResponse && publicResponse.ok(), `Public payment link must be reachable: ${publicResponse?.status()}`);
  const publicLinkApiResponse = await publicLinkApiPromise;
  const publicLinkApiText = await publicLinkApiResponse.text();
  assert.equal(publicLinkApiResponse.status(), 200, publicLinkApiText);
  const publicLinkApiBody = publicLinkApiText ? JSON.parse(publicLinkApiText) : {};
  assert.equal(publicLinkApiBody.apiVersion, 'v1');
  assert.equal(publicLinkApiBody.data?.amountAtomic, '2000000');
  assert.equal(publicLinkApiBody.data?.asset, 'USDC');
  assert.equal(typeof publicLinkApiBody.data?.amountDecimals, 'number');
  const expectedPublicAmount = `${formatAtomicForE2e(publicLinkApiBody.data.amountAtomic, publicLinkApiBody.data.amountDecimals)} ${publicLinkApiBody.data.asset}`;
  await publicPage.locator('.pay-public-link-card').waitFor({ state: 'visible', timeout: 10000 });
  const publicLinkText = (await publicPage.locator('.pay-public-link-card').innerText()).replace(/\s+/g, ' ').trim();
  console.log(`PUBLIC_PAYMENT_LINK_RENDER ${JSON.stringify({ amountAtomic: publicLinkApiBody.data.amountAtomic, amountDecimals: publicLinkApiBody.data.amountDecimals, asset: publicLinkApiBody.data.asset, expectedPublicAmount, cardText: publicLinkText.slice(0, 1000) })}`);
  assert.ok(publicLinkText.includes(expectedPublicAmount), `Public payment link must render the authoritative amount as ${expectedPublicAmount}. Body: ${publicLinkText}`);

  const publicCustomerForm = publicPage.locator('.pay-public-link-customer');
  await publicCustomerForm.waitFor({ state: 'visible', timeout: 10000 });
  await publicCustomerForm.locator('input').nth(0).fill('Ali');
  await publicCustomerForm.locator('input').nth(1).fill('Ahmadi');
  await publicCustomerForm.locator('textarea').fill('Production browser checkout verification');
  const payerFieldsText = await publicCustomerForm.innerText();
  assert.ok(payerFieldsText.includes('Payer information') || payerFieldsText.includes('بيانات الدافع') || payerFieldsText.includes('معلومات الدفع') || payerFieldsText.includes('Данные плательщика'));

  const publicCheckoutPost = (request) =>
    request.url().endsWith('/api/pay/v1/payment-links/' + encodeURIComponent(paymentLinkSlug))
    && request.method() === 'POST';
  const publicCheckoutResponsePromise = publicPage.waitForResponse(
    (response) => publicCheckoutPost(response.request()),
    { timeout: 15000 },
  );
  await publicPage.locator('.pay-public-link-actions .pay-primary-action').click();
  const publicCheckoutResponse = await publicCheckoutResponsePromise;
  const publicCheckoutText = await publicCheckoutResponse.text();
  assert.equal(publicCheckoutResponse.status(), 201, publicCheckoutText);
  const publicCheckoutBody = publicCheckoutText ? JSON.parse(publicCheckoutText) : {};
  assert.equal(publicCheckoutBody.apiVersion, 'v1');
  console.log(`PAYMENT_LINK_CREATE_PRODUCTION_E2E ${JSON.stringify({ status: publicCheckoutResponse.status(), paymentIntentId: publicCheckoutBody.data?.id, merchantId, paymentLinkSlug })}`);
  assert.equal(typeof publicCheckoutBody.data?.id, 'string');
  const publicIntentId = publicCheckoutBody.data.id;
  const publicIntentPayerFromDb = rows(await db(
    `select id, merchant_id, customer_first_name, customer_last_name, customer_purpose
       from public.pay_payment_intents
      where id = $1`,
    [publicIntentId],
    true,
  ));
  assert.equal(publicIntentPayerFromDb.length, 1, 'Public checkout Payment Intent must exist in production database.');
  assert.equal(publicIntentPayerFromDb[0].merchant_id, merchantId);
  assert.equal(publicIntentPayerFromDb[0].customer_first_name, 'Ali');
  assert.equal(publicIntentPayerFromDb[0].customer_last_name, 'Ahmadi');
  assert.equal(publicIntentPayerFromDb[0].customer_purpose, 'Production browser checkout verification');
  const publicIntentGetBodyText = await (await page.request.get(`${ORIGIN}/api/pay/v1/payment-intents/${encodeURIComponent(publicIntentId)}`)).text();
  assert.doesNotMatch(publicIntentGetBodyText, /customer_first_name|customer_last_name|customer_purpose/i,
    'Public Payment Intent GET must not expose payer PII.');

  await page.goto(ORIGIN + '/pay/checkout', { waitUntil: 'domcontentloaded' });
  await page.locator('.pay-checkout-intent-lookup').waitFor({ state: 'visible', timeout: 10000 });
  const intentLookup = page.locator('.pay-checkout-intent-lookup');
  await intentLookup.locator('input').fill(publicIntentId);
  const intentLookupResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/pay/v1/payment-intents/' + encodeURIComponent(publicIntentId))
    && response.request().method() === 'GET'
  );
  await intentLookup.locator('.pay-primary-action').click();
  const intentLookupResponse = await intentLookupResponsePromise;
  assert.equal(intentLookupResponse.status(), 200, await intentLookupResponse.text());
  await page.locator('.pay-checkout-status-grid').first().waitFor({ state: 'visible', timeout: 10000 });
  assert.ok((await page.locator('.pay-checkout-card').innerText()).includes('2 USDC'));
  assert.ok((await page.locator('.pay-checkout-intent-id').innerText()).includes(publicIntentId));
  console.log('PAYMENT_INTENT_LOOKUP_PRODUCTION_E2E passed through /pay/checkout.');

  await page.goto(ORIGIN + '/pay/invoices', { waitUntil: 'domcontentloaded' });
  await openPaymentLinksView(page);
  const linkedRow = page.locator('.pay-payment-links-table tbody tr').filter({ hasText: paymentLinkSlug });
  await linkedRow.locator('.pay-payment-links-actions .pay-icon-button').nth(1).click();
  await page.locator('.pay-payment-link-detail').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.pay-payment-link-detail .pay-secondary-action').filter({ hasText: /Delete link|حذف لینک|حذف الرابط|Удалить ссылку/i }).click();
  const linkedDeleteResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/pay/v1/payment-links?merchantId=') &&
    response.url().includes('&linkId=') &&
    response.request().method() === 'DELETE'
  );
  await page.locator('.pay-payment-link-detail .pay-primary-action').filter({ hasText: /Delete permanently|حذف نهایی|حذف نهائي|Удалить навсегда/i }).click();
  const linkedDeleteResponse = await linkedDeleteResponsePromise;
  const linkedDeleteText = await linkedDeleteResponse.text();
  assert.equal(linkedDeleteResponse.status(), 409, linkedDeleteText);
  assert.match(linkedDeleteText, /PAYMENT_LINK_HAS_PAYMENTS/);
  await page.locator('.pay-payment-link-detail').getByRole('button', { name: /Deactivate link|غیرفعال کردن لینک|تعطيل الرابط|Деактивировать ссылку/i }).click();
  const deactivatePatchResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/pay/v1/payment-links?merchantId=') &&
    response.url().includes('&linkId=') &&
    response.request().method() === 'PATCH'
  );
  await page.locator('.pay-payment-link-edit .pay-primary-action').filter({ hasText: /Save changes|ذخیره تغییرات|حفظ التغييرات|Сохранить изменения/i }).click();
  const deactivatePatchResponse = await deactivatePatchResponsePromise;
  const deactivatePatchText = await deactivatePatchResponse.text();
  assert.equal(deactivatePatchResponse.status(), 200, deactivatePatchText);
  const deactivatedLinkFromDb = rows(await db(
    `select id, is_active from public.pay_payment_links where id = $1`,
    [linkFromDb[0].id],
    true,
  ));
  assert.equal(deactivatedLinkFromDb.length, 1);
  assert.equal(deactivatedLinkFromDb[0].is_active, false);
  console.log(`PAYMENT_LINK_DELETE_GUARD_PRODUCTION_E2E ${JSON.stringify({
    deleteStatus: linkedDeleteResponse.status(),
    deactivateStatus: deactivatePatchResponse.status(),
    paymentLinkId: linkFromDb[0].id,
    isActive: deactivatedLinkFromDb[0].is_active,
  })}`);

  await publicPage.locator('.pay-checkout-card').waitFor({ state: 'visible', timeout: 10000 });
  const publicCheckoutUiText = await publicPage.locator('.pay-checkout-card').innerText();
  assert.ok(publicCheckoutUiText.includes('2 USDC') || publicCheckoutUiText.includes('2.000000 USDC'),
    'Public payment link must open the authoritative Checkout snapshot.');
  const publicIntentFromDb = rows(await db(
    `select id, merchant_id, payment_link_id, amount_atomic::text as amount_atomic, asset, status
       from public.pay_payment_intents
      where id = $1`,
    [publicIntentId],
    true,
  ));
  assert.equal(publicIntentFromDb.length, 1, 'Payment Intent created from public link must exist in production database.');
  assert.equal(publicIntentFromDb[0].merchant_id, merchantId);
  assert.equal(publicIntentFromDb[0].payment_link_id, linkFromDb[0].id);
  assert.equal(publicIntentFromDb[0].amount_atomic, '2000000');
  assert.equal(publicIntentFromDb[0].asset, 'USDC');
  assert.equal(publicIntentFromDb[0].status, 'created');
  await publicContext.close();

  const postWalletRouteResults = [];
  for (const [path, label] of routes) {
    postWalletRouteResults.push(await routeAudit(page, path, `postwallet-${label}`, '/tmp/pay-ui-evidence', apiEvents));
  }
  console.log(`POSTWALLET_ROUTE_AUDIT ${JSON.stringify({ routeCount: postWalletRouteResults.length, results: postWalletRouteResults.map(result => ({ path: result.path, apiEvents: result.apiEvents, excerpt: result.excerpt.slice(0, 300) })) })}`);

  // Grouped navigation regression: billing owns transactions/customers/reports, developer owns webhooks.
  await page.goto(ORIGIN + '/pay/invoices', { waitUntil: 'domcontentloaded' });
  await page.locator('.pay-billing').waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await page.locator('.pay-sidebar .pay-nav-item').count(), 7, 'Pay sidebar should expose seven primary entries after navigation consolidation.');
  assert.equal(await page.locator('.pay-billing-related-nav button').count(), 3, 'Billing hub must expose transactions, customers, and reports below the primary billing surface.');

  await page.locator('.pay-billing-related-nav button').filter({ hasText: /Customers|مشتریان|العملاء|Клиенты/i }).click();
  await page.locator('.pay-customers').waitFor({ state: 'visible', timeout: 10000 });
  assert.match((await page.locator('.pay-topbar-breadcrumb strong').innerText()).trim(), /Invoices & payment links|صورتحساب و لینک‌ها|الفواتير وروابط الدفع|Счета и платёжные ссылки/i);

  await page.goto(ORIGIN + '/pay/developer', { waitUntil: 'domcontentloaded' });
  await page.locator('.pay-developer').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.pay-developer-webhooks-section .pay-webhooks-shell').waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await page.locator('.pay-sidebar .pay-nav-item').count(), 7, 'Developer consolidation must keep the same seven primary entries.');

  await page.goto(ORIGIN + '/pay/merchants', { waitUntil: 'domcontentloaded' });
  await page.locator('.pay-api-keys').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.pay-api-create').waitFor({ state: 'visible', timeout: 10000 });

  const secretBefore = apiEvents.length;
  const apiName = page.locator('.pay-api-create input').nth(0);
  await apiName.fill('Browser UI Key');
  const keyResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/pay/v1/merchants/') && response.url().endsWith('/api-keys') && response.request().method() === 'POST'
  );
  await page.locator('.pay-api-create .pay-primary-action').click();
  const keyResponse = await keyResponsePromise;
  assert.equal(keyResponse.status(), 201, await keyResponse.text());
  const keyResponseBody = await keyResponse.json();
  console.log(`API_KEY_CREATE_RESPONSE_SHAPE ${JSON.stringify({
    status: keyResponse.status(),
    topLevelKeys: Object.keys(keyResponseBody || {}).sort(),
    apiKeyKeys: keyResponseBody?.apiKey && typeof keyResponseBody.apiKey === 'object' ? Object.keys(keyResponseBody.apiKey).sort() : [],
    secretPresent: typeof keyResponseBody?.secret === 'string' && keyResponseBody.secret.length > 0,
    secretLength: typeof keyResponseBody?.secret === 'string' ? keyResponseBody.secret.length : 0,
    secretAvailable: keyResponseBody?.secretAvailable ?? null,
  })}`);
  assert.equal(typeof keyResponseBody?.secret, 'string', 'Created API key response must expose the one-time secret.');
  assert.ok(keyResponseBody.secret.length >= 64, 'Created API key secret has an unexpected length.');
  await page.locator('.pay-api-secret-value code').waitFor({ state: 'visible', timeout: 10000 });
  const apiSecret = await page.locator('.pay-api-secret-value code').innerText();
  assert.match(apiSecret, /^sk_pay_[A-Za-z0-9_-]{64,}$/);

  const intentResponse = await context.request.post('/api/pay/v1/payment-intents', {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiSecret}`, 'Idempotency-Key': `browser-ui-e2e-${crypto.randomUUID()}` },
    data: {
      amountAtomic: '1000000',
      asset: 'SOL',
      feePayer: 'merchant',
      expiresInSeconds: 300,
      externalOrderId: `browser-ui-${Date.now()}`,
      metadata: {},
    },
  });
  assert.equal(intentResponse.status(), 201, await intentResponse.text());
  const intentBody = await intentResponse.json();
  const intentId = intentBody.data.id;
  assert.equal(typeof intentId, 'string');

  const routeResults = [];
  for (const [path, label] of routes) {
    routeResults.push(await routeAudit(page, path, label, '/tmp/pay-ui-evidence', apiEvents));
  }

  await page.goto(`${ORIGIN}/pay/checkout/${encodeURIComponent(intentId)}`, { waitUntil: 'domcontentloaded' });
  await page.getByText('SolMint Browser Test Merchant', { exact: true }).first().waitFor({ state: 'visible', timeout: 10000 });
  const checkoutText = await page.locator('body').innerText();
  assert.ok(checkoutText.includes('1 SOL') || checkoutText.includes('0.001 SOL'));

  // Mobile regression: RTL drawers must anchor to the right; LTR drawers to the left.
  const localeDirections = [['fa-IR', 'rtl'], ['en-US', 'ltr'], ['ar', 'rtl'], ['ru', 'ltr']];
  for (const [targetLocale, expectedDirection] of localeDirections) {
    await page.goto(`${ORIGIN}/pay`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const languageTrigger = page.locator('.pay-language-trigger');
    await languageTrigger.click();
    const optionLabel = targetLocale === 'fa-IR' ? 'فارسی' : targetLocale === 'en-US' ? 'English' : targetLocale === 'ar' ? 'العربية' : 'Русский';
    const option = page.locator('.pay-language-option').filter({ hasText: optionLabel }).first();
    await option.waitFor({ state: 'visible', timeout: 10000 });
    await option.click();
    await page.waitForFunction(
      (direction) => document.documentElement.getAttribute('dir') === direction,
      expectedDirection,
      { timeout: 10000 },
    );
    assert.equal(await page.locator('html').getAttribute('dir'), expectedDirection);
    const widthDiagnostics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(widthDiagnostics.scrollWidth <= widthDiagnostics.clientWidth + 1,
      `RTL page has horizontal overflow: scrollWidth=${widthDiagnostics.scrollWidth} clientWidth=${widthDiagnostics.clientWidth}`);
    const topbar = await page.locator('.pay-topbar').boundingBox();
    assert.ok(topbar, `RTL topbar missing for locale index ${targetLocale}`);
    assert.ok(topbar.x >= -1 && topbar.x + topbar.width <= VIEWPORT.width + 1,
      `RTL topbar is outside viewport: x=${topbar.x} width=${topbar.width}`);
    const languageBox = await page.locator('.pay-language-control').boundingBox();
    assert.ok(languageBox, 'RTL language selector is missing');
    assert.ok(languageBox.x >= -1 && languageBox.x + languageBox.width <= VIEWPORT.width + 1,
      `Language selector is outside viewport: x=${languageBox.x} width=${languageBox.width}`);
    const closedDrawer = await page.locator('.pay-sidebar').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        className: element.className,
        x: rect.x,
        width: rect.width,
        right: rect.right,
        pointerEvents: style.pointerEvents,
        visibility: style.visibility,
        transform: style.transform,
      };
    });
    console.log(`CLOSED_DRAWER_DIAGNOSTICS ${JSON.stringify({ targetLocale, expectedDirection, closedDrawer })}`);
    assert.equal(closedDrawer.pointerEvents, 'none', 'Closed mobile drawer must not intercept pointer events.');
    assert.equal(closedDrawer.visibility, 'hidden', 'Closed mobile drawer must be hidden from hit testing.');
    const menuBox = await page.locator('.pay-mobile-menu').boundingBox();
    assert.ok(menuBox, 'Mobile menu button must be present for hit-testing.');
    const hitTest = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return {
        tagName: element?.tagName || null,
        className: element?.getAttribute('class') || null,
        sidebarClassName: element?.closest('.pay-sidebar')?.getAttribute('class') || null,
      };
    }, {
      x: menuBox.x + menuBox.width / 2,
      y: menuBox.y + menuBox.height / 2,
    });
    assert.equal(hitTest.sidebarClassName, null,
      `Closed mobile drawer must not capture hamburger hit-testing: ${JSON.stringify(hitTest)}`);
    await page.locator('.pay-mobile-menu').click();
    await page.waitForFunction((direction) => {
      const drawer = document.querySelector('.pay-sidebar.is-mobile-open');
      if (!drawer) return false;
      const rect = drawer.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      if (direction === 'rtl') {
        return Math.abs(rect.right - window.innerWidth) < 1 && rect.left >= -1;
      }
      return Math.abs(rect.left) < 1 && rect.right <= window.innerWidth + 1;
    }, expectedDirection, { timeout: 3000 });
    const box = await page.locator('.pay-sidebar.is-mobile-open').boundingBox();
    assert.ok(box, `Mobile drawer did not open for locale ${targetLocale}`);
    assert.ok(box.width >= Math.min(VIEWPORT.width * 0.86, 320) - 2,
      `Mobile drawer opened in compact width: width=${box.width}`);
    if (expectedDirection === 'rtl') {
      assert.ok(box.x >= VIEWPORT.width - box.width - 2, `RTL drawer is off-screen: x=${box.x} width=${box.width}`);
      assert.ok(box.x < VIEWPORT.width - 10, 'RTL drawer did not occupy the expected right edge');
      assert.ok(box.x + box.width <= VIEWPORT.width + 1, `RTL drawer right edge is outside viewport: x=${box.x} width=${box.width}`);
    } else {
      assert.ok(box.x >= -1, `LTR drawer left edge is outside viewport: x=${box.x} width=${box.width}`);
      assert.ok(box.x + box.width <= VIEWPORT.width + 1, `LTR drawer right edge is outside viewport: x=${box.x} width=${box.width}`);
    }
    assert.ok(await page.locator('.pay-nav-item').first().isVisible());
    await page.screenshot({ path: `/tmp/pay-ui-evidence/mobile-rtl-${targetLocale}.png`, fullPage: false });
    await page.locator('.pay-mobile-close').click();
    assert.equal(await page.locator('.pay-sidebar.is-mobile-open').count(), 0, 'RTL drawer did not close');
  }

  // Pay must restore the host document locale after its SPA boundary unmounts.
  await page.evaluate(() => globalThis['history']['pushState']({}, '', '/'));
  await page.evaluate(() => globalThis.dispatchEvent(new PopStateEvent('popstate')));
  await page.waitForTimeout(350);
  assert.equal(await page.locator('html').getAttribute('lang'), 'fa', 'Leaving Pay must restore the host document language.');
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl', 'Leaving Pay must restore the host document direction.');
  assert.ok((await page.locator('body').innerText()).trim().length > 80, 'Host application did not render after leaving Pay.');

  console.log(JSON.stringify({
    status: 'PASS',
    merchantId,
    routeResults,
    apiEventCount: apiEvents.length,
    screenshotDir: '/tmp/pay-ui-evidence',
    checkoutIntentId: intentId,
  }, null, 2));

  await browser.close();
} finally {
  if (merchantId) {
    const result = await db('select id from public.pay_merchants where id = $1', [merchantId], true);
    const found = rows(result).length;
    if (found) await cleanup(fixture, merchantId);
    else {
      await db('delete from public.auth_identity_links where application_user_id = $1', [fixture.applicationUserId]).catch(() => {});
      await db('delete from public.users where id = $1', [fixture.applicationUserId]).catch(() => {});
      await db('delete from better_auth."user" where id = $1', [fixture.betterAuthUserId]).catch(() => {});
    }
  } else {
    await cleanup(fixture, '').catch(() => {});
  }
}

