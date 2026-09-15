import assert from 'node:assert/strict';
import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import test from 'node:test';
import { encodeBase58 } from '../src/pay/services/base58';

const ORIGIN = (process.env.SOLMINT_PAY_PRODUCTION_ORIGIN || 'https://solmint.ir').replace(/\/$/, '');
const EMAIL = (process.env.PAY_E2E_EMAIL || '').trim();
const PASSWORD = process.env.PAY_E2E_PASSWORD || '';
const MERCHANT_ID = (process.env.PAY_E2E_MERCHANT_ID || '').trim();
const FUNDER_SECRET = (process.env.DEVNET_E2E_FUNDER_SECRET_KEY_B64 || '').trim();
const TIMEOUT_MS = 20_000;

const PAYMENT_AMOUNT_ATOMIC = '1000000';
const PAYMENT_ASSET = 'SOL';
const PAYMENT_FEE_PAYER = 'merchant';

function requireConfig(): void {
  const missing = [
    ['PAY_E2E_EMAIL', EMAIL],
    ['PAY_E2E_PASSWORD', PASSWORD],
    ['PAY_E2E_MERCHANT_ID', MERCHANT_ID],
    ['DEVNET_E2E_FUNDER_SECRET_KEY_B64', FUNDER_SECRET],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length) throw new Error(`Missing controlled Pay Payment Intent E2E configuration: ${missing.join(', ')}`);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  let value: unknown;
  try {
    value = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Expected JSON response (status ${response.status}).`);
  }
  assert.equal(typeof value, 'object');
  assert.notEqual(value, null);
  return value as Record<string, unknown>;
}

function cookieHeader(response: Response): string {
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  const pairs = cookies.map((value) => value.split(';', 1)[0]).filter(Boolean);
  if (pairs.length) return pairs.join('; ');
  const fallback = response.headers.get('set-cookie') || '';
  return fallback
    .split(/,(?=[^;,]+=)/)
    .map((value) => value.split(';', 1)[0])
    .filter(Boolean)
    .join('; ');
}

async function request(path: string, init: RequestInit = {}, cookie = ''): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    headers.set('Origin', ORIGIN);
    if (cookie) headers.set('Cookie', cookie);
    return await fetch(`${ORIGIN}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
      redirect: 'manual',
    });
  } finally {
    clearTimeout(timer);
  }
}

async function signIn(): Promise<string> {
  const response = await request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await readJson(response);
  assert.equal(response.status, 200, `Better Auth sign-in failed with ${response.status}.`);
  assert.ok(body.user && typeof body.user === 'object');
  const cookie = cookieHeader(response);
  assert.ok(cookie, 'Better Auth must issue a session cookie.');
  return cookie;
}

function decodeBase58(value: string): Buffer {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const index = new Map([...alphabet].map((char, position) => [char, position]));
  let result = 0n;
  for (const char of value) {
    const digit = index.get(char);
    if (digit === undefined) throw new Error('Invalid Base58 key material.');
    result = result * 58n + BigInt(digit);
  }
  let hex = result.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const decoded = hex ? Buffer.from(hex, 'hex') : Buffer.alloc(0);
  let leadingZeros = 0;
  for (const char of value) {
    if (char !== '1') break;
    leadingZeros += 1;
  }
  return Buffer.concat([Buffer.alloc(leadingZeros), decoded]);
}

function decodeSecret(value: string): Uint8Array {
  const base64 = Buffer.from(value, 'base64');
  if (base64.length === 64) return base64;
  const base58 = decodeBase58(value);
  if (base58.length === 64) return base58;
  throw new Error('Controlled E2E wallet key must decode to a 64-byte Solana keypair.');
}

function assertIntentEnvelope(body: Record<string, unknown>): Record<string, unknown> {
  assert.equal(body.success, true);
  assert.equal(body.apiVersion, 'v1');
  assert.ok(body.data && typeof body.data === 'object');
  return body.data as Record<string, unknown>;
}

function paymentIntentId(body: Record<string, unknown>): string {
  const data = assertIntentEnvelope(body);
  assert.equal(typeof data.id, 'string');
  assert.match(data.id as string, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  return data.id as string;
}

function assertAuthoritativeSnapshot(data: Record<string, unknown>, walletAddress: string): void {
  assert.equal(data.merchant && typeof data.merchant === 'object', true);
  assert.equal(typeof data.amountAtomic, 'string');
  assert.match(data.amountAtomic as string, /^\d+$/);
  assert.equal(data.amountAtomic, PAYMENT_AMOUNT_ATOMIC);
  assert.equal(data.asset, PAYMENT_ASSET);
  assert.equal(data.tokenMint, null);
  assert.equal(data.tokenProgram, null);
  assert.equal(data.tokenDecimals, null);
  assert.equal(typeof data.recipient, 'string');
  assert.equal(data.recipient, walletAddress);
  assert.equal(typeof data.reference, 'string');
  assert.ok((data.reference as string).length >= 32);
  assert.ok((data.reference as string).length <= 44);
  assert.equal(data.feePayer, PAYMENT_FEE_PAYER);
  assert.equal(typeof data.feeAtomic, 'string');
  assert.match(data.feeAtomic as string, /^\d+$/);
  assert.equal(typeof data.customerTotalAtomic, 'string');
  assert.match(data.customerTotalAtomic as string, /^\d+$/);
  assert.equal(data.network, 'solana');
  assert.ok(['created', 'pending'].includes(String(data.status)));
  assert.equal(typeof data.expiresAt, 'string');
  assert.ok(new Date(data.expiresAt as string).getTime() > Date.now());
  assert.ok(['confirmed', 'finalized'].includes(String(data.verificationCommitment)));
}

test('controlled production Payment Intent creation remains backend-authoritative', async () => {
  requireConfig();

  const cookie = await signIn();
  const me = await request('/api/users/me', {}, cookie);
  assert.equal(me.status, 200);

  const createKeyResponse = await request(`/api/pay/v1/merchants/${encodeURIComponent(MERCHANT_ID)}/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `payment-intent-e2e-api-key-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({ name: 'pay-e2e-payment-intent', scopes: ['payment.create'], expiresAt: null }),
  }, cookie);
  const createKeyBody = await readJson(createKeyResponse);
  assert.equal(createKeyResponse.status, 201);
  const key = createKeyBody.apiKey;
  assert.ok(key && typeof key === 'object');
  const apiKeyId = (key as Record<string, unknown>).id;
  assert.equal(typeof apiKeyId, 'string');
  const secret = createKeyBody.secret;
  assert.equal(typeof secret, 'string');
  assert.match(secret as string, /^sk_pay_[A-Za-z0-9_-]{64,}$/);

  const funder = Keypair.fromSecretKey(decodeSecret(FUNDER_SECRET));
  const walletAddress = funder.publicKey.toBase58();

  const challengeResponse = await request(`/api/pay/v1/merchants/${encodeURIComponent(MERCHANT_ID)}/wallet-challenges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  }, cookie);
  const challengeBody = await readJson(challengeResponse);

  if (challengeResponse.status === 201) {
    assert.ok(challengeBody.challenge && typeof challengeBody.challenge === 'object');
    const challenge = challengeBody.challenge as Record<string, unknown>;
    assert.equal(typeof challenge.id, 'string');
    assert.equal(typeof challenge.message, 'string');
    assert.equal(challenge.walletAddress, walletAddress);
    assert.equal(typeof challenge.expiresAt, 'string');

    const messageBytes = new TextEncoder().encode(challenge.message as string);
    const signatureBytes = nacl.sign.detached(messageBytes, funder.secretKey);
    const verifyResponse = await request(`/api/pay/v1/merchants/${encodeURIComponent(MERCHANT_ID)}/wallet-challenges/${encodeURIComponent(challenge.id as string)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, signature: encodeBase58(signatureBytes) }),
    }, cookie);
    const verifyBody = await readJson(verifyResponse);
    assert.equal(verifyResponse.status, 200);
    assert.equal(verifyBody.verified, true);
    assert.equal(verifyBody.merchantId, MERCHANT_ID);
    assert.equal(verifyBody.walletAddress, walletAddress);
  } else {
    assert.equal(challengeResponse.status, 409);
    assert.equal(challengeBody.code, 'WALLET_ALREADY_VERIFIED');
  }

  const idempotencyKey = `payment-intent-e2e-${crypto.randomUUID()}`;
  const externalOrderId = `pay-intent-e2e-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const createBody = {
    amountAtomic: PAYMENT_AMOUNT_ATOMIC,
    asset: PAYMENT_ASSET,
    feePayer: PAYMENT_FEE_PAYER,
    expiresInSeconds: 300,
    externalOrderId,
    metadata: {},
  };
  const authHeaders = {
    Authorization: `Bearer ${secret as string}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  };

  const firstResponse = await request('/api/pay/v1/payment-intents', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(createBody),
  });
  const firstBody = await readJson(firstResponse);
  assert.equal(firstResponse.status, 201);
  const firstId = paymentIntentId(firstBody);
  const firstData = firstBody.data as Record<string, unknown>;
  assertAuthoritativeSnapshot(firstData, walletAddress);

  const readResponse = await request(`/api/pay/v1/payment-intents/${encodeURIComponent(firstId)}`);
  const readBody = await readJson(readResponse);
  assert.equal(readResponse.status, 200);
  const readData = assertIntentEnvelope(readBody);
  assert.equal(readData.id, firstId);
  assertAuthoritativeSnapshot(readData, walletAddress);

  const replayResponse = await request('/api/pay/v1/payment-intents', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(createBody),
  });
  const replayBody = await readJson(replayResponse);
  assert.equal(replayResponse.status, firstResponse.status);
  assert.equal(paymentIntentId(replayBody), firstId);

  const conflictResponse = await request('/api/pay/v1/payment-intents', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ ...createBody, amountAtomic: '2000000' }),
  });
  const conflictBody = await readJson(conflictResponse);
  assert.equal(conflictResponse.status, 409);
  assert.equal(conflictBody.code, 'IDEMPOTENCY_CONFLICT');

  const revokeResponse = await request(`/api/pay/v1/merchants/${encodeURIComponent(MERCHANT_ID)}/api-keys/${encodeURIComponent(apiKeyId as string)}`, {
    method: 'DELETE',
  }, cookie);
  const revokeBody = await readJson(revokeResponse);
  assert.equal(revokeResponse.status, 200);
  assert.equal((revokeBody.apiKey as Record<string, unknown>)?.status, 'revoked');
});
