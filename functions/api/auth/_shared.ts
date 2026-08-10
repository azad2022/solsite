export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
}

export interface AuthUser {
  id: string;
  username: string;
  full_name: string;
  role: string;
  permissions: unknown;
  is_active: boolean;
  created_at: string;
}

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const SESSION_COOKIE = 'solmint_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'CDN-Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

function getBaseUrl(env: Env) {
  return (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
}

function getSecret(env: Env) {
  return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function pbkdf2(value: string, saltHex: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(value), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: hexToBytes(saltHex),
    iterations,
    hash: 'SHA-256'
  }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function randomHex(bytes = 16): Promise<string> {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return bytesToHex(data);
}

async function verifyPassword(password: string, stored: string): Promise<{ valid: boolean; upgradedHash?: string }> {
  if (!password || !stored) return { valid: false };

  // Backward-compatible verification for the existing SHA-256 hashes.
  if (/^[a-f0-9]{64}$/i.test(stored)) {
    const legacy = await sha256(password);
    if (legacy !== stored.toLowerCase()) return { valid: false };

    // Upgrade successful legacy credentials to salted PBKDF2 on first login.
    const salt = await randomHex(16);
    const iterations = 310000;
    const derived = await pbkdf2(password, salt, iterations);
    return { valid: true, upgradedHash: `pbkdf2-sha256$${iterations}$${salt}$${derived}` };
  }

  const match = /^pbkdf2-sha256\$(\d+)\$([a-f0-9]+)\$([a-f0-9]+)$/i.exec(stored);
  if (!match) return { valid: false };

  const iterations = Number(match[1]);
  const expected = match[4].toLowerCase();
  const derived = await pbkdf2(password, match[3], iterations);
  return { valid: derived === expected };
}

async function supabaseRequest(env: Env, path: string, init: RequestInit = {}) {
  const secret = getSecret(env);
  if (!secret) throw new Error('SUPABASE_SECRET_KEY is not configured for the production authentication function.');
  return fetch(`${getBaseUrl(env)}${path}`, {
    ...init,
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      ...(init.headers || {})
    }
  });
}

export function getSessionToken(request: Request): string {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)solmint_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function createSession(env: Env, user: AuthUser): Promise<string> {
  const rawToken = `${await randomHex(32)}${await randomHex(32)}`;
  const tokenHash = await sha256(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  const response = await supabaseRequest(env, '/rest/v1/auth_sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt })
  });
  if (!response.ok) throw new Error(await response.text());
  return rawToken;
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export async function getAuthenticatedUser(env: Env, request: Request): Promise<AuthUser | null> {
  const token = getSessionToken(request);
  if (!token) return null;

  const tokenHash = await sha256(token);
  const response = await supabaseRequest(env, `/rest/v1/auth_sessions?select=user_id,expires_at&token_hash=eq.${encodeURIComponent(tokenHash)}&limit=1`);
  if (!response.ok) return null;
  const sessions = await response.json() as Array<{ user_id: string; expires_at: string }>;
  const session = sessions[0];
  if (!session || Date.parse(session.expires_at) <= Date.now()) return null;

  const userResponse = await supabaseRequest(env, `/rest/v1/users?select=id,username,full_name,role,permissions,is_active,created_at&id=eq.${encodeURIComponent(session.user_id)}&limit=1`);
  if (!userResponse.ok) return null;
  const users = await userResponse.json() as AuthUser[];
  const user = users[0];
  if (!user || user.is_active === false) return null;

  // Sliding activity timestamp; failure here must not invalidate a valid session.
  await supabaseRequest(env, `/rest/v1/auth_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ last_seen_at: new Date().toISOString() })
  }).catch(() => {});

  return user;
}

export async function destroySession(env: Env, request: Request): Promise<void> {
  const token = getSessionToken(request);
  if (!token) return;
  const tokenHash = await sha256(token);
  await supabaseRequest(env, `/rest/v1/auth_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}`, {
    method: 'DELETE'
  }).catch(() => {});
}

export async function findUser(env: Env, username: string): Promise<AuthUser & { password_hash: string } | null> {
  const response = await supabaseRequest(env, `/rest/v1/users?select=id,username,full_name,password_hash,role,permissions,is_active,created_at&username=eq.${encodeURIComponent(username)}&limit=1`);
  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json() as Array<AuthUser & { password_hash: string }>;
  return rows[0] || null;
}

export async function upgradePasswordHash(env: Env, userId: string, passwordHash: string): Promise<void> {
  await supabaseRequest(env, `/rest/v1/users?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ password_hash: passwordHash })
  });
}

export function toSafeUser(user: AuthUser) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    isActive: user.is_active,
    createdAt: user.created_at
  };
}
