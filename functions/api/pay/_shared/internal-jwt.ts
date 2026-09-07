const encoder = new TextEncoder();

export const PAY_INTERNAL_JWT_ROLE = 'authenticated' as const;
export const PAY_INTERNAL_JWT_CLAIM = 'solmint_user_id' as const;
export const PAY_INTERNAL_JWT_ALGORITHMS = ['ES256', 'RS256'] as const;
export const PAY_INTERNAL_JWT_DEFAULT_TTL_SECONDS = 60;
export const PAY_INTERNAL_JWT_MIN_TTL_SECONDS = 30;
export const PAY_INTERNAL_JWT_MAX_TTL_SECONDS = 300;

type SupportedAlgorithm = (typeof PAY_INTERNAL_JWT_ALGORITHMS)[number];

export interface PayInternalJwtEnv {
  SUPABASE_URL?: string;
  SUPABASE_INTERNAL_JWT_PRIVATE_KEY?: string;
  SUPABASE_INTERNAL_JWT_ALGORITHM?: string;
  SUPABASE_INTERNAL_JWT_KEY_ID?: string;
  SUPABASE_INTERNAL_JWT_ISSUER?: string;
  SUPABASE_INTERNAL_JWT_AUDIENCE?: string;
  SUPABASE_INTERNAL_JWT_TTL_SECONDS?: string;
}

interface JwtHeader {
  alg: SupportedAlgorithm;
  typ: 'JWT';
  kid: string;
}

interface JwtPayload {
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  role: typeof PAY_INTERNAL_JWT_ROLE;
  [PAY_INTERNAL_JWT_CLAIM]: string;
}

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToDer(pem: string): ArrayBuffer {
  const normalized = pem.trim();
  if (!normalized.startsWith('-----BEGIN PRIVATE KEY-----') || !normalized.endsWith('-----END PRIVATE KEY-----')) {
    throw new Error('SUPABASE_INTERNAL_JWT_PRIVATE_KEY must be a PKCS#8 PEM private key.');
  }
  const body = normalized.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s+/g, '');
  if (!body || body.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) throw new Error('SUPABASE_INTERNAL_JWT_PRIVATE_KEY contains invalid base64 data.');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function requireNonEmpty(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required for the Pay internal JWT bridge.`);
  if (/\r|\n/.test(normalized)) throw new Error(`${name} must not contain CR/LF characters.`);
  return normalized;
}

function parseAlgorithm(env: PayInternalJwtEnv): SupportedAlgorithm {
  const value = (env.SUPABASE_INTERNAL_JWT_ALGORITHM || '').trim();
  if (!PAY_INTERNAL_JWT_ALGORITHMS.includes(value as SupportedAlgorithm)) throw new Error('SUPABASE_INTERNAL_JWT_ALGORITHM must be explicitly configured as ES256 or RS256.');
  return value as SupportedAlgorithm;
}

function parseTtl(env: PayInternalJwtEnv): number {
  const raw = env.SUPABASE_INTERNAL_JWT_TTL_SECONDS?.trim() || String(PAY_INTERNAL_JWT_DEFAULT_TTL_SECONDS);
  const ttl = Number(raw);
  if (!Number.isInteger(ttl) || ttl < PAY_INTERNAL_JWT_MIN_TTL_SECONDS || ttl > PAY_INTERNAL_JWT_MAX_TTL_SECONDS) {
    throw new Error(`SUPABASE_INTERNAL_JWT_TTL_SECONDS must be an integer between ${PAY_INTERNAL_JWT_MIN_TTL_SECONDS} and ${PAY_INTERNAL_JWT_MAX_TTL_SECONDS}.`);
  }
  return ttl;
}

function getImportAlgorithm(algorithm: SupportedAlgorithm): AlgorithmIdentifier | EcKeyImportParams | RsaHashedImportParams {
  return algorithm === 'ES256' ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
}

function getSignAlgorithm(algorithm: SupportedAlgorithm): AlgorithmIdentifier | EcdsaParams {
  return algorithm === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' };
}

async function importPrivateKey(env: PayInternalJwtEnv): Promise<{ algorithm: SupportedAlgorithm; key: CryptoKey }> {
  const algorithm = parseAlgorithm(env);
  const pem = requireNonEmpty('SUPABASE_INTERNAL_JWT_PRIVATE_KEY', env.SUPABASE_INTERNAL_JWT_PRIVATE_KEY);
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(pem), getImportAlgorithm(algorithm), false, ['sign']);
  return { algorithm, key };
}

function assertSafeUserId(userId: string): string {
  const normalized = userId.trim();
  if (!normalized || normalized.length > 256 || /[^\x21-\x7e]/.test(normalized)) throw new Error('Pay internal JWT user id is invalid.');
  return normalized;
}

export function validatePayInternalJwtConfig(env: PayInternalJwtEnv): void {
  requireNonEmpty('SUPABASE_URL', env.SUPABASE_URL);
  const privateKey = requireNonEmpty('SUPABASE_INTERNAL_JWT_PRIVATE_KEY', env.SUPABASE_INTERNAL_JWT_PRIVATE_KEY);
  parseAlgorithm(env);
  requireNonEmpty('SUPABASE_INTERNAL_JWT_KEY_ID', env.SUPABASE_INTERNAL_JWT_KEY_ID);
  requireNonEmpty('SUPABASE_INTERNAL_JWT_ISSUER', env.SUPABASE_INTERNAL_JWT_ISSUER);
  requireNonEmpty('SUPABASE_INTERNAL_JWT_AUDIENCE', env.SUPABASE_INTERNAL_JWT_AUDIENCE);
  parseTtl(env);
  pemToDer(privateKey);
}

export async function mintPayInternalJwt(env: PayInternalJwtEnv, userId: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  validatePayInternalJwtConfig(env);
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 1) throw new Error('JWT issuance time must be a positive safe integer.');
  const normalizedUserId = assertSafeUserId(userId);
  const issuer = requireNonEmpty('SUPABASE_INTERNAL_JWT_ISSUER', env.SUPABASE_INTERNAL_JWT_ISSUER);
  const audience = requireNonEmpty('SUPABASE_INTERNAL_JWT_AUDIENCE', env.SUPABASE_INTERNAL_JWT_AUDIENCE);
  const keyId = requireNonEmpty('SUPABASE_INTERNAL_JWT_KEY_ID', env.SUPABASE_INTERNAL_JWT_KEY_ID);
  const ttl = parseTtl(env);
  const { algorithm, key } = await importPrivateKey(env);
  const header: JwtHeader = { alg: algorithm, typ: 'JWT', kid: keyId };
  const payload: JwtPayload = { iss: issuer, aud: audience, iat: nowSeconds, exp: nowSeconds + ttl, role: PAY_INTERNAL_JWT_ROLE, [PAY_INTERNAL_JWT_CLAIM]: normalizedUserId };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await crypto.subtle.sign(getSignAlgorithm(algorithm), key, encoder.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}
