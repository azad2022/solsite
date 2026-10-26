import { enforcePayRateLimit, hashCanonicalRequest, PayRuntimeError, supabaseRequest, type PayRuntimeEnv } from './runtime';

/**
 * Ticket endpoints use both authenticated-user and Cloudflare edge-IP buckets.
 * Raw IPs are never stored: rate-limit subject identifiers are SHA-256 hashes.
 */
export async function enforceTicketRateLimit(
  env: PayRuntimeEnv,
  request: Request,
  userId: string,
  action: string,
  windowSeconds: number,
  userMaxRequests: number,
  ipMaxRequests: number,
): Promise<void> {
  await enforcePayRateLimit(env, `tickets:${action}:user`, await hashCanonicalRequest({ userId }), windowSeconds, userMaxRequests);

  const clientIp = request.headers.get('CF-Connecting-IP')?.trim();
  if (clientIp) {
    await enforcePayRateLimit(env, `tickets:${action}:ip`, await hashCanonicalRequest({ clientIp }), windowSeconds, ipMaxRequests);
  }
}

export function requireTicketJson(request: Request): void {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new PayRuntimeError('UNSUPPORTED_MEDIA_TYPE', 415, 'Ticket mutations must use application/json.');
  }
}

export async function isTicketUserBlocked(env: PayRuntimeEnv, userId: string): Promise<boolean> {
  const response = await supabaseRequest(
    env,
    `/rest/v1/pay_ticket_user_blocks?select=user_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    { headers: { Accept: 'application/json' } },
  );
  const rows = await response.json() as Array<{ user_id: string }>;
  return rows.length > 0;
}
