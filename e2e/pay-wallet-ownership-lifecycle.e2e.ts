// Production Wallet Ownership lifecycle E2E. Fixture credentials and signer keys exist only for this process.
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { Pool } from 'pg';
import test from 'node:test';
import { encodeBase58 } from '../src/pay/services/base58';

const ORIGIN = (process.env.SOLMINT_PAY_PRODUCTION_ORIGIN || 'https://solmint.ir').replace(/\/$/, '');
const OTHER_MERCHANT_ID = (process.env.PAY_E2E_OTHER_MERCHANT_ID || '').trim();
const DB_URL = (process.env.SUPABASE_DB_URL || '').trim();
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || '';
const REQUEST_TIMEOUT_MS = 20_000;

function requireConfig(): void {
  const missing = [
    ['PAY_E2E_OTHER_MERCHANT_ID', OTHER_MERCHANT_ID],
    ['SUPABASE_DB_URL', DB_URL],
    ['SUPABASE_DB_PASSWORD', DB_PASSWORD],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Missing existing Wallet Ownership E2E configuration: ${missing.join(', ')}`);
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

interface WalletSigner { address: string; privateKey: ReturnType<typeof generateKeyPairSync>['privateKey']; }
interface Fixture {
  db: Pool;
  betterAuthUserId: string;
  applicationUserId: string;
  merchantId: string;
  password: string;
  email: string;
  wallet: WalletSigner;
}

function createWalletSigner(): WalletSigner {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const spki = publicKey.export({ format: 'der', type: 'spki' });
  const rawPublicKey = spki.subarray(spki.length - 32);
  assert.equal(rawPublicKey.length, 32);
  return { address: encodeBase58(rawPublicKey), privateKey };
}

function createDatabasePool(): Pool {
  try {
    const parsed = new URL(DB_URL);
    return new Pool({
      connectionString: DB_URL,
      max: 1,
      ssl: { rejectUnauthorized: false },
      ...(parsed.password ? {} : { password: DB_PASSWORD }),
    });
  } catch {
    throw new Error('SUPABASE_DB_URL is not a valid database connection URL.');
  }
}

async function provisionFixture(): Promise<Fixture> {
  const db = createDatabasePool();
  const betterAuthUserId = crypto.randomUUID();
  const applicationUserId = betterAuthUserId;
  const runId = crypto.randomUUID().replaceAll('-', '');
  const email = `pay-wallet-e2e-${runId}@solmint.invalid`;
  const username = `pay_wallet_e2e_${runId.slice(0, 20)}`;
  const password = `E2E-${randomBytes(24).toString('base64url')}`;
  const passwordHash = await hashPassword(password);
  const merchantId = crypto.randomUUID();
  const wallet = createWalletSigner();

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'insert into better_auth."user" (id, name, email, email_verified, username, created_at, updated_at) values ($1,$2,$3,true,$4,now(),now())',
      [betterAuthUserId, 'SolMint Pay Wallet E2E', email, username],
    );
    await client.query(
      'insert into better_auth.account (id, user_id, account_id, provider_id, password, created_at, updated_at) values ($1,$2,$3,$4,$5,now(),now())',
      [betterAuthUserId, betterAuthUserId, betterAuthUserId, 'credential', passwordHash],
    );
    await client.query(
      'insert into public.users (id, username, full_name, password_hash, role, permissions, is_active, created_at) values ($1,$2,$3,$4,$5,$6,true,now())',
      [applicationUserId, username, 'SolMint Pay Wallet E2E', passwordHash, 'user', JSON.stringify([])],
    );
    await client.query(
      'insert into public.auth_identity_links (better_auth_user_id, application_user_id, source, created_at, updated_at) values ($1,$2,$3,now(),now())',
      [betterAuthUserId, applicationUserId, 'native'],
    );
    await client.query(
      'insert into public.pay_merchants (id, owner_user_id, business_name, slug, status) values ($1,$2,$3,$4,$5)',
      [merchantId, applicationUserId, 'SolMint Pay Wallet E2E', `pay-wallet-e2e-${runId}`, 'pending'],
    );
    await client.query(
      'insert into public.pay_merchant_members (merchant_id, user_id, role, status) values ($1,$2,$3,$4)',
      [merchantId, applicationUserId, 'owner', 'active'],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    await db.end().catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  return { db, betterAuthUserId, applicationUserId, merchantId, password, email, wallet };
}

async function cleanupFixture(fixture: Fixture): Promise<void> {
  const client = await fixture.db.connect();
  try {
    await client.query('BEGIN');
    await client.query('delete from public.pay_merchants where id = $1', [fixture.merchantId]);
    await client.query('delete from public.users where id = $1', [fixture.applicationUserId]);
    await client.query('delete from better_auth."user" where id = $1', [fixture.betterAuthUserId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await fixture.db.end();
  }
}

async function expireChallenge(fixture: Fixture, challengeId: string): Promise<void> {
  await fixture.db.query(
    "update public.pay_wallet_challenges set expires_at = now() - interval '1 second' where id = $1 and merchant_id = $2 and consumed_at is null",
    [challengeId, fixture.merchantId],
  );
}

async function signIn(email: string, password: string): Promise<string> {
  const response = await request('/api/auth/sign-in/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const body = await readJson(response);
  assert.equal(response.status, 200, `Better Auth sign-in failed with ${response.status}.`);
  assert.ok(body.user && typeof body.user === 'object');
  const cookie = cookieHeader(response);
  assert.ok(cookie, 'Better Auth must issue a session cookie.');
  return cookie;
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

test('authenticated Wallet Ownership Lifecycle is isolated and server-authoritative', { timeout: 240_000 }, async () => {
  requireConfig();
  const fixture = await provisionFixture();
  try {
    const cookie = await signIn(fixture.email, fixture.password);
    const me = await request('/api/users/me', {}, cookie);
    assert.equal(me.status, 200);

    const merchants = await request('/api/pay/v1/merchants', {}, cookie);
    const merchantsBody = await readJson(merchants);
    assert.equal(merchants.status, 200, `Merchant lookup via internal JWT bridge failed (code=${String(merchantsBody.code || 'unknown')}, requestId=${String(merchantsBody.requestId || 'unknown')}).`);
    assert.ok(merchantsBody.merchant && typeof merchantsBody.merchant === 'object');
    assert.equal((merchantsBody.merchant as Record<string, unknown>).id, fixture.merchantId);

    const noSession = await request(`/api/pay/v1/merchants/${encodeURIComponent(fixture.merchantId)}/wallet-challenges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: fixture.wallet.address }),
    });
    const noSessionBody = await readJson(noSession);
    assert.equal(noSession.status, 401);
    assert.equal(noSessionBody.code, 'UNAUTHORIZED');
    assertRedactedError(noSessionBody);

    const badOrigin = await request(`/api/pay/v1/merchants/${encodeURIComponent(fixture.merchantId)}/wallet-challenges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: fixture.wallet.address }),
    }, cookie, 'https://evil.example');
    const badOriginBody = await readJson(badOrigin);
    assert.equal(badOrigin.status, 403);
    assert.equal(badOriginBody.code, 'ORIGIN_FORBIDDEN');
    assertRedactedError(badOriginBody);

    const crossIssue = await issueChallenge(cookie, fixture.merchantId, fixture.wallet.address);
    assert.equal(crossIssue.response.status, 201);
    const crossChallenge = challenge(crossIssue.body);
    const crossMerchantAttempt = await verify(cookie, OTHER_MERCHANT_ID, crossChallenge.id, crossChallenge.walletAddress, 'invalid');
    assert.equal(crossMerchantAttempt.response.status, 403);
    assert.equal(crossMerchantAttempt.body.code, 'FORBIDDEN');
    assertRedactedError(crossMerchantAttempt.body);

    const wallet = fixture.wallet;
    const challengeResponse = await issueChallenge(cookie, fixture.merchantId, wallet.address);
    assert.equal(challengeResponse.response.status, 201);
    const activeChallenge = challenge(challengeResponse.body);
    assert.equal(activeChallenge.walletAddress, wallet.address);
    assert.match(activeChallenge.message, /SolMint Pay wallet ownership verification/);

    const wrongWallet = createWalletSigner();
    const wrongWalletSignature = signMessage(activeChallenge.message, wrongWallet);
    const mismatch = await verify(cookie, fixture.merchantId, activeChallenge.id, wrongWallet.address, wrongWalletSignature);
    assert.equal(mismatch.response.status, 400);
    assert.equal(mismatch.body.code, 'WALLET_MISMATCH');
    assertRedactedError(mismatch.body);

    const tampered = await verify(cookie, fixture.merchantId, activeChallenge.id, wallet.address, tamperBase58(signMessage(activeChallenge.message, wallet)));
    assert.equal(tampered.response.status, 400);
    assert.equal(tampered.body.code, 'INVALID_SIGNATURE');
    assertRedactedError(tampered.body);

    const verified = await verify(cookie, fixture.merchantId, activeChallenge.id, wallet.address, signMessage(activeChallenge.message, wallet));
    assert.equal(verified.response.status, 200);
    assert.equal(verified.body.verified, true);
    assert.equal(verified.body.merchantId, fixture.merchantId);
    assert.equal(verified.body.walletAddress, wallet.address);
    assertRedactedError(verified.body);

    const replay = await verify(cookie, fixture.merchantId, activeChallenge.id, wallet.address, signMessage(activeChallenge.message, wallet));
    assert.equal(replay.response.status, 409);
    assert.equal(replay.body.code, 'CHALLENGE_ALREADY_USED');
    assertRedactedError(replay.body);

    const concurrentWallet = createWalletSigner();
    const concurrentChallengeResponse = await issueChallenge(cookie, fixture.merchantId, concurrentWallet.address);
    assert.equal(concurrentChallengeResponse.response.status, 201);
    const concurrentChallenge = challenge(concurrentChallengeResponse.body);
    const concurrentSignature = signMessage(concurrentChallenge.message, concurrentWallet);
    const concurrent = await Promise.all([
      verify(cookie, fixture.merchantId, concurrentChallenge.id, concurrentChallenge.walletAddress, concurrentSignature),
      verify(cookie, fixture.merchantId, concurrentChallenge.id, concurrentChallenge.walletAddress, concurrentSignature),
    ]);
    assert.deepEqual(concurrent.map((item) => item.response.status).sort((a, b) => a - b), [200, 409]);
    assert.equal(concurrent.filter((item) => item.body.verified === true).length, 1);
    assert.equal(concurrent.filter((item) => item.body.code === 'CHALLENGE_ALREADY_USED').length, 1);
    concurrent.forEach((item) => assertRedactedError(item.body));

    const expiredWallet = createWalletSigner();
    const expiredResponse = await issueChallenge(cookie, fixture.merchantId, expiredWallet.address);
    assert.equal(expiredResponse.response.status, 201);
    const expiredChallenge = challenge(expiredResponse.body);
    assert.ok(new Date(expiredChallenge.expiresAt).getTime() > Date.now());
    await expireChallenge(fixture, expiredChallenge.id);
    const expired = await verify(cookie, fixture.merchantId, expiredChallenge.id, expiredWallet.address, signMessage(expiredChallenge.message, expiredWallet));
    assert.equal(expired.response.status, 410);
    assert.equal(expired.body.code, 'CHALLENGE_EXPIRED');
    assertRedactedError(expired.body);

    const badOriginVerify = await verify(cookie, fixture.merchantId, expiredChallenge.id, expiredWallet.address, 'invalid', 'https://evil.example');
    assert.equal(badOriginVerify.response.status, 403);
    assert.equal(badOriginVerify.body.code, 'ORIGIN_FORBIDDEN');
    assertRedactedError(badOriginVerify.body);
  } finally {
    await cleanupFixture(fixture);
  }
});
