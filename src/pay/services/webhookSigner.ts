/**
 * Merchant webhook signing contract.
 *
 * The signer consumes a secret supplied by a dedicated key-management provider.
 * This module deliberately does not persist, decrypt, rotate, or otherwise own
 * secrets. A deployment without a KMS-backed secret provider must fail closed.
 */

const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;
const HEX = /^[0-9a-f]+$/i;

export interface WebhookSecretProvider {
  getSigningSecret(webhookId: string, keyVersion: string | null): Promise<string | null>;
}

function assertSecret(secret: string): void {
  if (secret.length < 32 || secret.length > 4096) throw new Error('Invalid webhook signing secret length.');
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return bytesToHex(new Uint8Array(signature));
}

/**
 * Sign the exact UTF-8 request body. Never parse and re-stringify JSON before
 * signing because equivalent JSON may have different byte representations.
 */
export async function signWebhookPayload(input: {
  webhookId: string;
  eventId: string;
  timestampSeconds: number;
  rawBody: string;
  keyVersion: string | null;
  secretProvider: WebhookSecretProvider;
}): Promise<string> {
  if (!Number.isInteger(input.timestampSeconds) || input.timestampSeconds <= 0) throw new Error('Invalid webhook timestamp.');
  if (!input.webhookId || !input.eventId) throw new Error('Webhook identity is required.');
  const secret = await input.secretProvider.getSigningSecret(input.webhookId, input.keyVersion);
  if (!secret) throw new Error('Webhook signing secret is unavailable.');
  assertSecret(secret);
  const signedPayload = `${input.timestampSeconds}.${input.eventId}.${input.rawBody}`;
  const digest = await hmacSha256Hex(secret, signedPayload);
  return `t=${input.timestampSeconds},v1=${digest}`;
}

export function parseWebhookSignatureHeader(header: string): { timestampSeconds: number; signatures: string[] } {
  const fields = new Map<string, string[]>();
  for (const part of header.split(',')) {
    const [key, value] = part.split('=', 2);
    if (!key || !value) continue;
    const values = fields.get(key) || [];
    values.push(value);
    fields.set(key, values);
  }
  const timestampSeconds = Number(fields.get('t')?.[0]);
  const signatures = fields.get('v1') || [];
  if (!Number.isInteger(timestampSeconds) || signatures.length === 0 || signatures.some((value) => !HEX.test(value) || value.length !== 64)) {
    throw new Error('Malformed webhook signature header.');
  }
  return { timestampSeconds, signatures };
}

export function assertFreshWebhookTimestamp(timestampSeconds: number, nowSeconds = Math.floor(Date.now() / 1000)): void {
  if (!Number.isInteger(timestampSeconds)) throw new Error('Invalid webhook timestamp.');
  if (Math.abs(nowSeconds - timestampSeconds) > MAX_TIMESTAMP_SKEW_SECONDS) throw new Error('Webhook signature timestamp is outside the replay window.');
}

/** Constant-time equality for fixed-length ASCII hex digests. */
export function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length || !HEX.test(a) || !HEX.test(b)) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

export async function verifyWebhookPayload(input: {
  webhookId: string;
  eventId: string;
  header: string;
  rawBody: string;
  keyVersion: string | null;
  secretProvider: WebhookSecretProvider;
  nowSeconds?: number;
}): Promise<boolean> {
  let parsed: { timestampSeconds: number; signatures: string[] };
  try {
    parsed = parseWebhookSignatureHeader(input.header);
    assertFreshWebhookTimestamp(parsed.timestampSeconds, input.nowSeconds);
  } catch {
    return false;
  }

  const expected = await signWebhookPayload({
    webhookId: input.webhookId,
    eventId: input.eventId,
    timestampSeconds: parsed.timestampSeconds,
    rawBody: input.rawBody,
    keyVersion: input.keyVersion,
    secretProvider: input.secretProvider,
  }).catch(() => null);
  if (!expected) return false;

  const expectedDigest = expected.slice(expected.indexOf('v1=') + 3);
  return parsed.signatures.some((candidate) => constantTimeHexEqual(candidate, expectedDigest));
}
