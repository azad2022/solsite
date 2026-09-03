import { validateWebhookUrl } from './securityPolicy';

export const WEBHOOK_MAX_ATTEMPTS = 8;
export const WEBHOOK_TIMEOUT_MS = 10_000;
export const WEBHOOK_MAX_BODY_BYTES = 256 * 1024;

export function webhookRetryDelaySeconds(attemptCount: number): number {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) throw new Error('Invalid webhook attempt count.');
  return Math.min(21_600, Math.max(30, 30 * (2 ** Math.min(attemptCount - 1, 8))));
}

export function shouldDeadLetter(attemptCount: number, maxAttempts = WEBHOOK_MAX_ATTEMPTS): boolean {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) throw new Error('Invalid webhook attempt count.');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) throw new Error('Invalid webhook maximum attempts.');
  return attemptCount >= maxAttempts;
}

interface WebhookEgressEnv {
  PAY_WEBHOOK_EGRESS_URL?: string;
  PAY_WEBHOOK_EGRESS_SECRET?: string;
}

function requireEgressConfiguration(env: WebhookEgressEnv | undefined): { url: string; secret: string } {
  const url = env?.PAY_WEBHOOK_EGRESS_URL?.trim();
  const secret = env?.PAY_WEBHOOK_EGRESS_SECRET?.trim();
  if (!url || !secret || secret.length < 32) throw new Error('Webhook egress is not configured.');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Webhook egress URL is not allowed.');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname || (parsed.port && parsed.port !== '443')) {
    throw new Error('Webhook egress URL is not allowed.');
  }
  return { url: parsed.toString(), secret };
}

export async function fetchWebhookWithTimeout(input: {
  endpointUrl: string;
  signatureHeader: string;
  body: string;
  timeoutMs?: number;
  env?: WebhookEgressEnv;
}): Promise<{ ok: boolean; status: number }> {
  const timeoutMs = input.timeoutMs ?? WEBHOOK_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30_000) throw new Error('Invalid webhook timeout.');
  if (!validateWebhookUrl(input.endpointUrl)) throw new Error('Webhook endpoint URL is not allowed.');
  if (new TextEncoder().encode(input.body).byteLength > WEBHOOK_MAX_BODY_BYTES) throw new Error('Webhook payload is too large.');

  const egress = requireEgressConfiguration(input.env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(egress.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${egress.secret}`,
        'X-SolMint-Egress-Target': input.endpointUrl,
        'X-SolMint-Signature': input.signatureHeader,
      },
      body: JSON.stringify({ endpointUrl: input.endpointUrl, signatureHeader: input.signatureHeader, body: input.body }),
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Webhook egress unavailable (${response.status}).`);
    const data = await response.json() as { ok?: boolean; status?: number };
    if (data.ok !== true || !Number.isInteger(data.status) || data.status < 100 || data.status > 599) {
      throw new Error('Webhook egress returned an invalid response.');
    }
    return { ok: data.status >= 200 && data.status < 300, status: data.status };
  } finally {
    clearTimeout(timer);
  }
}
