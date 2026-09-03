import { Resolver } from 'node:dns/promises';
import { timingSafeEqual } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import type { IncomingMessage } from 'node:http';
import { isIP } from 'node:net';

export const EGRESS_BODY_LIMIT = 256 * 1024;
export const EGRESS_RESPONSE_LIMIT = 16 * 1024;
export const EGRESS_TIMEOUT_MS = 10_000;
export const MAX_WEBHOOK_ENDPOINT_URL_BYTES = 2048;

function ip4(value: string): number {
  return value.split('.').reduce((acc, octet) => ((acc << 8) | Number(octet)) >>> 0, 0);
}

const IPV4_UNSAFE_RANGES: Array<[number, number]> = [
  [ip4('0.0.0.0'), ip4('0.255.255.255')], [ip4('10.0.0.0'), ip4('10.255.255.255')],
  [ip4('100.64.0.0'), ip4('100.127.255.255')], [ip4('127.0.0.0'), ip4('127.255.255.255')],
  [ip4('169.254.0.0'), ip4('169.254.255.255')], [ip4('172.16.0.0'), ip4('172.31.255.255')],
  [ip4('192.0.0.0'), ip4('192.0.0.255')], [ip4('192.0.2.0'), ip4('192.0.2.255')],
  [ip4('192.168.0.0'), ip4('192.168.255.255')], [ip4('198.18.0.0'), ip4('198.19.255.255')],
  [ip4('198.51.100.0'), ip4('198.51.100.255')], [ip4('203.0.113.0'), ip4('203.0.113.255')],
  [ip4('224.0.0.0'), ip4('255.255.255.255')],
];

function isUnsafeIpv4(value: string): boolean {
  const numeric = ip4(value);
  return IPV4_UNSAFE_RANGES.some(([start, end]) => numeric >= start && numeric <= end);
}

function normalizeIpv6(value: string): string {
  return value.trim().toLowerCase().replace(/^\[|\]$/g, '');
}

function isUnsafeIpv6(value: string): boolean {
  const normalized = normalizeIpv6(value);
  if (normalized === '::' || normalized === '::1' || normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('ff') || normalized.startsWith('2001:db8:')) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isUnsafeIpv4(mapped[1]) : false;
}

export function isPublicIp(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) return !isUnsafeIpv4(address);
  if (kind === 6) return !isUnsafeIpv6(address);
  return false;
}

export function assertPublicResolution(addresses: string[]): string[] {
  const unique = [...new Set(addresses.map((value) => value.trim()))].filter(Boolean);
  if (unique.length === 0) throw new Error('Webhook target did not resolve.');
  if (unique.some((address) => !isPublicIp(address))) throw new Error('Webhook target resolved to a non-public address.');
  return unique;
}

export async function resolvePublicAddresses(hostname: string, resolver = new Resolver()): Promise<string[]> {
  const [v4, v6] = await Promise.all([
    resolver.resolve4(hostname).catch(() => [] as string[]),
    resolver.resolve6(hostname).catch(() => [] as string[]),
  ]);
  return assertPublicResolution([...v4, ...v6]);
}

function hostHeaderFor(target: URL): string {
  const hostname = target.hostname.replace(/^\[|\]$/g, '');
  return isIP(hostname) === 6 ? `[${hostname}]` : hostname;
}

export function buildPinnedHttpsOptions(target: URL, address: string, bodyLength: number, signatureHeader = '', timeoutMs = EGRESS_TIMEOUT_MS) {
  if (target.protocol !== 'https:') throw new Error('Webhook target must use HTTPS.');
  if (target.port && target.port !== '443') throw new Error('Webhook target must use TCP 443.');
  if (target.hash) throw new Error('Webhook target must not contain a fragment.');
  if (!isPublicIp(address)) throw new Error('Pinned webhook address is not public.');
  if (!Number.isInteger(bodyLength) || bodyLength < 0 || bodyLength > EGRESS_BODY_LIMIT) throw new Error('Invalid webhook body size.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30_000) throw new Error('Invalid webhook timeout.');
  const hostname = target.hostname.replace(/^\[|\]$/g, '');
  const targetIsIp = isIP(hostname) !== 0;
  return {
    protocol: 'https:', hostname: address, port: 443,
    ...(targetIsIp ? {} : { servername: hostname }),
    path: `${target.pathname || '/'}${target.search}`, method: 'POST',
    headers: { Host: hostHeaderFor(target), 'Content-Type': 'application/json', 'Content-Length': bodyLength, Accept: 'application/json', 'User-Agent': 'SolMint-Pay-Webhook/1.0', 'X-SolMint-Signature': signatureHeader },
    rejectUnauthorized: true, timeout: timeoutMs,
  } as const;
}

async function readRequestBody(request: Request): Promise<string> {
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > EGRESS_BODY_LIMIT) throw new Error('Webhook payload is too large.');
  }
  const body = await request.text();
  if (Buffer.byteLength(body, 'utf8') > EGRESS_BODY_LIMIT) throw new Error('Webhook payload is too large.');
  return body;
}

export interface EgressConfig { secret: string; resolver?: Resolver; }

function authorize(request: Request, secret: string): void {
  if (secret.length < 32) throw new Error('Egress secret is not configured.');
  const header = request.headers.get('authorization') || '';
  if (!/^Bearer\s+/i.test(header)) throw new Error('Unauthorized.');
  const provided = Buffer.from(header.replace(/^Bearer\s+/i, '').trim());
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw new Error('Unauthorized.');
}

async function performPinnedPost(target: URL, body: string, signatureHeader: string, resolver: Resolver): Promise<number> {
  if (target.username || target.password) throw new Error('Webhook target credentials are not allowed.');
  if (Buffer.byteLength(target.toString(), 'utf8') > MAX_WEBHOOK_ENDPOINT_URL_BYTES) throw new Error('Webhook target URL is too large.');
  if (target.protocol !== 'https:' || (target.port && target.port !== '443') || target.hash) throw new Error('Webhook target is not allowed.');
  const normalizedHostname = target.hostname.replace(/^\[|\]$/g, '');
  if (isIP(normalizedHostname) && !isPublicIp(normalizedHostname)) throw new Error('Webhook target is not public.');
  const addresses = isIP(normalizedHostname) ? [normalizedHostname] : await resolvePublicAddresses(normalizedHostname, resolver);
  let lastError: unknown;
  for (const address of addresses) {
    try {
      return await new Promise<number>((resolve, reject) => {
        const options = buildPinnedHttpsOptions(target, address, Buffer.byteLength(body, 'utf8'), signatureHeader);
        const req = httpsRequest(options, (response: IncomingMessage) => {
          let consumed = 0;
          response.on('data', (chunk: Buffer) => { consumed += chunk.byteLength; if (consumed > EGRESS_RESPONSE_LIMIT) response.destroy(new Error('Webhook response is too large.')); });
          response.on('end', () => resolve(response.statusCode ?? 502));
          response.on('error', reject);
        });
        req.on('timeout', () => req.destroy(new Error('Webhook egress timeout.')));
        req.on('error', reject);
        req.end(body);
      });
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error('Webhook egress failed.');
}

export async function handleWebhookEgressRequest(request: Request, config: EgressConfig): Promise<Response> {
  try {
    authorize(request, config.secret);
    if (request.method !== 'POST') return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
    const rawBody = await readRequestBody(request);
    const parsed = JSON.parse(rawBody) as { endpointUrl?: string; signatureHeader?: string; body?: string };
    if (!parsed.endpointUrl || !parsed.signatureHeader || typeof parsed.body !== 'string') throw new Error('Invalid egress payload.');
    const targetHeader = request.headers.get('x-solmint-egress-target');
    if (!targetHeader || targetHeader !== parsed.endpointUrl) throw new Error('Invalid egress target binding.');
    if (Buffer.byteLength(parsed.body, 'utf8') > EGRESS_BODY_LIMIT) throw new Error('Webhook payload is too large.');
    const target = new URL(parsed.endpointUrl);
    const status = await performPinnedPost(target, parsed.body, parsed.signatureHeader, config.resolver ?? new Resolver());
    return json({ ok: true, status }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Egress request failed.';
    const status = message === 'Unauthorized.' ? 401 : message.includes('not allowed') || message.includes('not public') || message.includes('non-public') || message.includes('did not resolve') || message.includes('target URL') || message.includes('fragment') || message.includes('target binding') ? 422 : 502;
    return json({ ok: false, code: status === 422 ? 'EGRESS_TARGET_REJECTED' : status === 401 ? 'UNAUTHORIZED' : 'EGRESS_FAILED' }, status);
  }
}

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
