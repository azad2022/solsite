import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import { encodeBase58 } from '../src/pay/services/base58';

const ORIGIN = (process.env.SOLMINT_PAY_PRODUCTION_ORIGIN || 'https://solmint.ir').replace(/\/$/, '');
const EMAIL = (process.env.PAY_E2E_EMAIL || '').trim();
const PASSWORD = process.env.PAY_E2E_PASSWORD || '';
const OTHER_MERCHANT_ID = (process.env.PAY_E2E_OTHER_MERCHANT_ID || '').trim();
const REQUEST_TIMEOUT_MS = 20_000;
const CHALLENGE_WAIT_MS = 10 * 60 * 1000 + 5_000;

function requireConfig(): void {
  const missing = [
    ['PAY_E2E_EMAIL', EMAIL],
    ['PAY_E2E_PASSWORD', PASSWORD],
    ['PAY_E2E_OTHER_MERCHANT_ID', OTHER_MERCHANT_ID],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Missing existing Pay E2E configuration: ${missing.join(', ')}`);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  let value: unknown;
  try { value = text ? JSON.parse(text) : {}; } catch { throw new Error(`Expected JSON response (status ${response.status}).`); }
  assert.equal(typeof value, 'object');
  assert.notEqual(value, null);
  return value as Record<string, unknown>;
}

function cookieHeader(response: Response): string {
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  const pairs = cookies.map((value) => value.split(';', 1)[0]).filter(Boolean);
  if (pairs.length) return pairs.join('; ');
  return (response.headers.get('set-cookie') || '').split(/,(?=[^;,]+=)/).map((value) => value.split(';', 1)[0]).filter(Boolean).join('; ');
}

async function request(path: string, init: RequestInit = {}, cookie = '', origin = ORIGIN): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    headers.set('Origin', origin);
    if (cookie) headers.set('Cookie', cookie);
    return await fetch(`${ORIGIN}${path}`, { ...init, headers, signal: controller.signal, redirect: 'manual' });
  } finally { clearTimeout(timer); }
}

async function signIn(): Promise<string> {
  const response = await request('/api/auth/sign-in/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  const body = await readJson(response);
  assert.equal(response.status, 200, `Better Auth sign-in failed with ${response.status}.`);
  assert.ok(body.user && typeof body.user === 'object');
  const cookie = cookieHeader(response);
  assert.ok(cookie, 'Better Auth must issue a session cookie.');
  return cookie;
}

interface Merchant { id: string; owner_user_id?: string; business_name?: string; slug?: string; status?: string; }

function readMerchant(body: Record<string, unknown>): Merchant {
  assert.ok(body.merchant && typeof body.merchant === 'object');
  const merchant = body.merchant as Record<string, unknown>;
  assert.equal(typeof merchant.id, 'string');
  return merchant as Merchant;
}

async function ensureMerchant(cookie: string): Promise<string> {
  const existingResponse = await request('/api/pay/v1/merchants', {}, cookie);
  const existingBody = await readJson(existingResponse);
  assert.equal(existingResponse.status, 200);

  if (existingBody.merchant !== null) {
    const merchant = readMerchant(existingBody);
    assert.equal(merchant.status, 'active');
    return merchant.id;
  }

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const createResponse = await request('/api/pay/v1/merchants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessName: `SolMint Pay Wallet E2E ${suffix}`, slug: `wallet-e2e-${suffix}` }),
  }, cookie);
  const createBody = await readJson(createResponse);
  assert.equal(createResponse.status, 201);
  const merchant = readMerchant(createBody);
  assert.equal(createBody.created, true);
  assert.equal(merchant.status, 'active');
  return merchant.id;
}

interface WalletSigner { address: string; privateKey: ReturnType<typeof generateKeyPairSync>['privateKey']; }

function createWalletSigner(): WalletSigner {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const spki = publicKey.export({ format: 'der', type: 'spki' });
  const rawPublicKey = spki.subarray(spki.length - 32);
  assert.equal(rawPublicKey.length, 32);
  return { address: encodeBase58(rawPublicKey), privateKey };
}

function signMessage(message: string, wallet: WalletSigner): string {
  const signature = sign(null, Buffer.from(message, 'utf8'), wallet.privateKey);
  assert.equal(signature.length, 64);
  return encodeBase58(signature);
}

function tamperBase58(signature: string): string {
  const chars = [...signature];
  const index = chars.length - 1;
  chars[index] = chars[index] === '1' ? '2' : '1';
  return chars.join('');
}

async function issueChallenge(cookie: string, merchantId: string, walletAddress: string): Promise<{ response: Response; body: Record<string, unknown> }> {
  const response = await request(`/api/pay/v1/merchants/${encodeURIComponent(merchantId)}/wallet-challenges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  }, cookie);
  return { response, body: await readJson(response) };
}

function challenge(body: Record<string, unknown>): Record<string, string> {
  assert.ok(body.challenge && typeof body.challenge === 'object');
  const row = body.challenge as Record<string, unknown>;
  for (const field of ['id', 'message', 'walletAddress', 'expiresAt']) assert.equal(typeof row[field], 'string');
  return row as Record<string, string>;
}

async function verify(cookie: string, merchantId: string, challengeId: string, walletAddress: string, signature: string, origin = ORIGIN) {
  const response = await request(`/api/pay/v1/merchants/${encodeURIComponent(merchantId)}/wallet-challenges/${encodeURIComponent(challengeId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, signature }),
  }, cookie, origin);
  return { response, body: await readJson(response) };
}

function assertRedactedError(body: Record<string, unknown>): void {
  assert.equal('stack' in body, false);
  assert.equal('error' in body, false);
  assert.equal('details' in body, false);
  assert.equal('trace' in body, false);
}

async function waitForExpiry(): Promise<void> { await new Promise((resolve) => setTimeout(resolve, CHALLENGE_WAIT_MS)); }

test('authenticated Wallet Ownership Lifecycle is isolated and server-authoritative', async () => {
  requireConfig();

  const cookie = await signIn();
  const me = await request('/api/users/me', {}, cookie);
  assert.equal(me.status, 200);

  const merchantId = await ensureMerchant(cookie);

  const noSession = await request(`/api/pay/v1/merchants/${encodeURIComponent(merchantId)}/wallet-challenges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: createWalletSigner().address }),
  });
  const noSessionBody = await readJson(noSession);
  assert.equal(noSession.status, 401);
  assert.equal(noSessionBody.code, 'UNAUTHORIZED');
  assertRedactedError(noSessionBody);

  const badOrigin = await request(`/api/pay/v1/merchants/${encodeURIComponent(merchantId)}/wallet-challenges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: createWalletSigner().address }),
  }, cookie, 'https://evil.example');
  const badOriginBody = await readJson(badOrigin);
  assert.equal(badOrigin.status, 403);
  assert.equal(badOriginBody.code, 'ORIGIN_FORBIDDEN');
  assertRedactedError(badOriginBody);

  const crossIssue = await issueChallenge(cookie, merchantId, createWalletSigner().address);
  assert.equal(crossIssue.response.status, 201);
  const crossChallenge = challenge(crossIssue.body);
  const crossMerchantAttempt = await verify(cookie, OTHER_MERCHANT_ID, crossChallenge.id, crossChallenge.walletAddress, 'invalid');
  assert.equal(crossMerchantAttempt.response.status, 403);
  assert.equal(crossMerchantAttempt.body.code, 'FORBIDDEN');
  assertRedactedError(crossMerchantAttempt.body);

  const wallet = createWalletSigner();
  const challengeResponse = await issueChallenge(cookie, merchantId, wallet.address);
  assert.equal(challengeResponse.response.status, 201);
  const activeChallenge = challenge(challengeResponse.body);
  assert.equal(activeChallenge.walletAddress, wallet.address);
  assert.match(activeChallenge.message, /SolMint Pay wallet ownership verification/);

  const wrongWallet = createWalletSigner();
  const wrongWalletSignature = signMessage(activeChallenge.message, wrongWallet);
  const mismatch = await verify(cookie, merchantId, activeChallenge.id, wrongWallet.address, wrongWalletSignature);
  assert.equal(mismatch.response.status, 400);
  assert.equal(mismatch.body.code, 'WALLET_MISMATCH');
  assertRedactedError(mismatch.body);

  const tampered = await verify(cookie, merchantId, activeChallenge.id, wallet.address, tamperBase58(signMessage(activeChallenge.message, wallet)));
  assert.equal(tampered.response.status, 400);
  assert.equal(tampered.body.code, 'INVALID_SIGNATURE');
  assertRedactedError(tampered.body);

  const verified = await verify(cookie, merchantId, activeChallenge.id, wallet.address, signMessage(activeChallenge.message, wallet));
  assert.equal(verified.response.status, 200);
  assert.equal(verified.body.verified, true);
  assert.equal(verified.body.merchantId, merchantId);
  assert.equal(verified.body.walletAddress, wallet.address);
  assertRedactedError(verified.body);

  const replay = await verify(cookie, merchantId, activeChallenge.id, wallet.address, signMessage(activeChallenge.message, wallet));
  assert.equal(replay.response.status, 409);
  assert.equal(replay.body.code, 'CHALLENGE_ALREADY_USED');
  assertRedactedError(replay.body);

  const concurrentWallet = createWalletSigner();
  const concurrentChallengeResponse = await issueChallenge(cookie, merchantId, concurrentWallet.address);
  assert.equal(concurrentChallengeResponse.response.status, 201);
  const concurrentChallenge = challenge(concurrentChallengeResponse.body);
  const concurrentSignature = signMessage(concurrentChallenge.message, concurrentWallet);
  const concurrent = await Promise.all([
    verify(cookie, merchantId, concurrentChallenge.id, concurrentWallet.address, concurrentSignature),
    verify(cookie, merchantId, concurrentChallenge.id, concurrentWallet.address, concurrentSignature),
  ]);
  assert.deepEqual(concurrent.map((item) => item.response.status).sort((a, b) => a - b), [200, 409]);
  assert.equal(concurrent.filter((item) => item.body.verified === true).length, 1);
  assert.equal(concurrent.filter((item) => item.body.code === 'CHALLENGE_ALREADY_USED').length, 1);
  concurrent.forEach((item) => assertRedactedError(item.body));

  const expiredWallet = createWalletSigner();
  const expiredResponse = await issueChallenge(cookie, merchantId, expiredWallet.address);
  assert.equal(expiredResponse.response.status, 201);
  const expiredChallenge = challenge(expiredResponse.body);
  assert.ok(new Date(expiredChallenge.expiresAt).getTime() > Date.now());
  await waitForExpiry();
  const expired = await verify(cookie, merchantId, expiredChallenge.id, expiredWallet.address, signMessage(expiredChallenge.message, expiredWallet));
  assert.equal(expired.response.status, 410);
  assert.equal(expired.body.code, 'CHALLENGE_EXPIRED');
  assertRedactedError(expired.body);

  const badOriginVerify = await verify(cookie, merchantId, expiredChallenge.id, expiredWallet.address, 'invalid', 'https://evil.example');
  assert.equal(badOriginVerify.response.status, 403);
  assert.equal(badOriginVerify.body.code, 'ORIGIN_FORBIDDEN');
  assertRedactedError(badOriginVerify.body);
});
