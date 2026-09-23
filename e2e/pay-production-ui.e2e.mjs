import assert from 'node:assert/strict';
import { randomBytes, generateKeyPairSync, sign } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { chromium } from 'playwright';

const ORIGIN = (process.env.SOLMINT_PAY_PRODUCTION_ORIGIN || 'https://solmint.ir').replace(/\/$/, '');
const SUPABASE_ACCESS_TOKEN = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();
const PROJECT_REF = 'nvopkbiedorfshwbmyhn';
const VIEWPORT = { width: 390, height: 844 };

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
  assert.equal(body.verified, true);
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

async function routeAudit(page, path, label, evidenceDir, apiEvents) {
  apiEvents.length = 0;
  const response = await page.goto(`${ORIGIN}${path}`, { waitUntil: 'domcontentloaded' });
  assert.ok(response && response.ok(), `Navigation failed for ${path}: ${response?.status()}`);
  await page.waitForTimeout(1100);
  const title = await page.title();
  const bodyText = await page.locator('body').innerText();
  assert.ok(bodyText.trim().length > 80, `${path} rendered too little content`);
  assert.equal(await page.locator('.pay-app-shell').count(), 1, `${path} must render the Pay shell`);
  const bad = apiEvents.filter((event) => event.status >= 400);
  if (bad.length) throw new Error(`${path} produced Pay API errors: ${JSON.stringify(bad)}`);
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
  page.on('response', async (response) => {
    if (!response.url().includes('/api/pay/')) return;
    apiEvents.push({ url: response.url(), status: response.status(), method: response.request().method() });
  });

  await page.goto(`${ORIGIN}/pay/merchants`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
  const onboardingForm = page.locator('.pay-onboarding-form');
  await onboardingForm.waitFor({ state: 'visible', timeout: 10000 });
  await onboardingForm.locator('input').nth(0).fill('SolMint Browser Test Merchant');
  const createResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/pay/v1/merchants') && response.request().method() === 'POST'
  );
  await onboardingForm.locator('.pay-primary-action').click();
  const createResponse = await createResponsePromise;
  assert.equal(createResponse.status(), 201, await createResponse.text());
  const createBody = await createResponse.json();
  merchantId = createBody.merchant.id;
  await page.getByText('SolMint Browser Test Merchant', { exact: true }).first().waitFor({ state: 'visible', timeout: 10000 });

  await signWalletChallenge(context, merchantId, signer);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  assert.ok((await page.locator('body').innerText()).includes(signer.address.slice(0, 8)));
  assert.ok((await page.locator('body').innerText()).includes('active') || (await page.locator('body').innerText()).includes('فعال'));

  const secretBefore = apiEvents.length;
  const apiName = page.locator('.pay-api-create input').nth(0);
  await apiName.fill('Browser UI Key');
  const keyResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/pay/v1/merchants/') && response.url().endsWith('/api-keys') && response.request().method() === 'POST'
  );
  await page.locator('.pay-api-create .pay-primary-action').click();
  const keyResponse = await keyResponsePromise;
  assert.equal(keyResponse.status(), 201, await keyResponse.text());
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
  await page.waitForTimeout(900);
  assert.ok((await page.locator('body').innerText()).includes('SolMint Browser Test Merchant'));
  assert.ok((await page.locator('body').innerText()).includes('1 SOL') || (await page.locator('body').innerText()).includes('0.001 SOL'));

  // RTL/mobile regression: FA and AR must switch direction and keep the drawer on-screen.
  for (const localeButton of [0, 2]) {
    await page.goto(`${ORIGIN}/pay`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.locator('.pay-language-control button').nth(localeButton).click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    await page.locator('.pay-mobile-menu').click();
    const box = await page.locator('.pay-sidebar.is-mobile-open').boundingBox();
    assert.ok(box, `RTL drawer did not open for locale index ${localeButton}`);
    assert.ok(box.x >= VIEWPORT.width - box.width - 2, `RTL drawer is off-screen: x=${box.x} width=${box.width}`);
    assert.ok(box.x < VIEWPORT.width - 10, 'RTL drawer did not occupy the expected right edge');
    assert.ok(await page.locator('.pay-nav-item').first().isVisible());
    await page.screenshot({ path: `/tmp/pay-ui-evidence/mobile-rtl-${localeButton}.png`, fullPage: false });
    await page.locator('.pay-mobile-close').click();
  }

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