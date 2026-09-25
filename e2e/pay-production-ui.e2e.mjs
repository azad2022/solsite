import assert from 'node:assert/strict';
import { randomBytes, generateKeyPairSync, sign } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const ORIGIN = (process.env.SOLMINT_PAY_PRODUCTION_ORIGIN || 'https://solmint.ir').replace(/\/$/, '');
const SUPABASE_ACCESS_TOKEN = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const PROJECT_REF = 'nvopkbiedorfshwbmyhn';
const VIEWPORT = { width: 390, height: 844 };
const EVIDENCE_DIR = '/tmp/pay-ui-evidence';
mkdirSync(EVIDENCE_DIR, { recursive: true });

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

function walletSigner() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const spki = publicKey.export({ format: 'der', type: 'spki' });
  const raw = spki.subarray(spki.length - 32);
  return { address: encodeBase58(raw), privateKey };
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

async function signWalletChallenge(context, merchantId, signer) {
  const challengeResponse = await context.request.post(
    `/api/pay/v1/merchants/${encodeURIComponent(merchantId)}/wallet-challenges`,
    { headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, data: { walletAddress: signer.address } },
  );
  assert.equal(challengeResponse.status(), 201, `Wallet challenge failed: ${await challengeResponse.text()}`);
  const challenge = (await challengeResponse.json()).challenge;
  const signature = sign(null, Buffer.from(challenge.message, 'utf8'), signer.privateKey);
  const verifyResponse = await context.request.post(
    `/api/pay/v1/merchants/${encodeURIComponent(merchantId)}/wallet-challenges/${encodeURIComponent(challenge.id)}`,
    { headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, data: { walletAddress: signer.address, signature: encodeBase58(signature) } },
  );
  assert.equal(verifyResponse.status(), 200, `Wallet verification failed: ${await verifyResponse.text()}`);
  const body = await verifyResponse.json();
  console.log(`WALLET_VERIFY_RESULT ${JSON.stringify({ status: verifyResponse.status(), verified: body.verified, merchantId: body.merchantId, walletId: body.walletId, walletAddress: body.walletAddress, verifiedAt: body.verifiedAt })}`);
  assert.equal(body.verified, true);
  return body;
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
  await page.waitForTimeout(1400);
  if (['/pay','/pay/merchants','/pay/dashboard','/pay/transactions','/pay/customers','/pay/invoices','/pay/reports','/pay/security','/pay/webhooks','/pay/tickets'].includes(path)) {
    await page.waitForFunction(() => !document.body.innerText.includes('Loading Merchant state'), { timeout: 10000 }).catch(() => {});
  }
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
const signer = walletSigner();

try {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: ORIGIN, viewport: VIEWPORT, locale: 'en-US' });
  const apiEvents = [];
  context.on('request', () => {});
  await directSignIn(context, fixture);

  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') console.log(`BROWSER_CONSOLE_ERROR ${message.text()}`);
  });
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

  const verifiedWalletResponse = await signWalletChallenge(context, merchantId, signer);
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
    verifiedWalletResponse,
    api: { status: authoritativeAfterVerify.status, body: authoritativeAfterVerifyText.slice(0, 3000) },
    databaseWalletState,
  })}`);

  await page.goto(`${ORIGIN}/pay/merchants`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pay-api-keys', { state: 'visible', timeout: 10000 });
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
  }, signer.address.slice(0, 8));
  console.log(`WALLET_AFTER_RELOAD ${JSON.stringify(walletAfterReload)}`);
  assert.equal(walletAfterReload.status, 200, `Authoritative merchant GET after reload failed: ${walletAfterReload.text}`);
  assert.equal(walletAfterReload.merchantStatus, 'active',
    `Merchant must remain active after reload: ${walletAfterReload.text}`);
  assert.equal(walletAfterReload.walletVerificationStatus, 'verified',
    `Verified wallet must survive reload: ${walletAfterReload.text}`);
  assert.equal(walletAfterReload.addressMatches, true,
    `Authoritative wallet address changed after reload: ${walletAfterReload.text}`);

  await page.goto(ORIGIN + '/pay', { waitUntil: 'domcontentloaded' });
  await page.getByText('SolMint Browser Test Merchant', { exact: true }).first().waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('.pay-getting-started-footnote').waitFor({ state: 'visible', timeout: 10000 });
  const overviewTextAfterReload = await page.locator('body').innerText();
  assert.ok(overviewTextAfterReload.includes('SolMint Browser Test Merchant'),
    'Overview must render the authoritative merchant data after reload.');

  const postWalletRouteResults = [];
  for (const [path, label] of routes) {
    postWalletRouteResults.push(await routeAudit(page, path, `postwallet-${label}`, '/tmp/pay-ui-evidence', apiEvents));
  }
  console.log(`POSTWALLET_ROUTE_AUDIT ${JSON.stringify({ routeCount: postWalletRouteResults.length, results: postWalletRouteResults.map(result => ({ path: result.path, apiEvents: result.apiEvents, excerpt: result.excerpt.slice(0, 300) })) })}`);

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
  for (const [localeButton, expectedDirection] of [[0, 'rtl'], [1, 'ltr'], [2, 'rtl'], [3, 'ltr']]) {
    await page.goto(`${ORIGIN}/pay`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.locator('.pay-language-control button').nth(localeButton).click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('html').getAttribute('dir'), expectedDirection);
    const widthDiagnostics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(widthDiagnostics.scrollWidth <= widthDiagnostics.clientWidth + 1,
      `RTL page has horizontal overflow: scrollWidth=${widthDiagnostics.scrollWidth} clientWidth=${widthDiagnostics.clientWidth}`);
    const topbar = await page.locator('.pay-topbar').boundingBox();
    assert.ok(topbar, `RTL topbar missing for locale index ${localeButton}`);
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
    console.log(`CLOSED_DRAWER_DIAGNOSTICS ${JSON.stringify({ localeButton, expectedDirection, closedDrawer })}`);
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
    assert.ok(box, `RTL drawer did not open for locale index ${localeButton}`);
    if (expectedDirection === 'rtl') {
      assert.ok(box.x >= VIEWPORT.width - box.width - 2, `RTL drawer is off-screen: x=${box.x} width=${box.width}`);
      assert.ok(box.x < VIEWPORT.width - 10, 'RTL drawer did not occupy the expected right edge');
      assert.ok(box.x + box.width <= VIEWPORT.width + 1, `RTL drawer right edge is outside viewport: x=${box.x} width=${box.width}`);
    } else {
      assert.ok(box.x >= -1, `LTR drawer left edge is outside viewport: x=${box.x} width=${box.width}`);
      assert.ok(box.x + box.width <= VIEWPORT.width + 1, `LTR drawer right edge is outside viewport: x=${box.x} width=${box.width}`);
    }
    assert.ok(await page.locator('.pay-nav-item').first().isVisible());
    await page.screenshot({ path: `/tmp/pay-ui-evidence/mobile-rtl-${localeButton}.png`, fullPage: false });
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

