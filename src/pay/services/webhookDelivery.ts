export const WEBHOOK_MAX_ATTEMPTS = 8;
export const WEBHOOK_TIMEOUT_MS = 10_000;

export function webhookRetryDelaySeconds(attemptCount: number): number {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) throw new Error('Invalid webhook attempt count.');
  return Math.min(21_600, Math.max(30, 30 * (2 ** Math.min(attemptCount - 1, 8))));
}

export function shouldDeadLetter(attemptCount: number, maxAttempts = WEBHOOK_MAX_ATTEMPTS): boolean {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) throw new Error('Invalid webhook attempt count.');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) throw new Error('Invalid webhook maximum attempts.');
  return attemptCount >= maxAttempts;
}

export async function fetchWebhookWithTimeout(input: {
  endpointUrl: string;
  signatureHeader: string;
  body: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number }> {
  const timeoutMs = input.timeoutMs ?? WEBHOOK_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30_000) throw new Error('Invalid webhook timeout.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'SolMint-Pay-Webhook/1.0',
        'X-SolMint-Signature': input.signatureHeader,
      },
      body: input.body,
      redirect: 'error',
      signal: controller.signal,
    });
    return { ok: response.status >= 200 && response.status < 300, status: response.status };
  } finally {
    clearTimeout(timer);
  }
}
