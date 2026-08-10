import { scrypt as nodeScrypt } from 'node:crypto';

export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  AUTH_RATE_LIMIT_SECRET?: string;
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
const SESSION_COOKIE = '__Host-solmint_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_BLOCK_SECONDS = 15 * 60;

export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'CDN-Cache-Control': 'no-store', ...extraHeaders } });
}

function getBaseUrl(env: Env) { return (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, ''); }
function getSecret(env: Env) { return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || ''; }

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function pbkdf2(value: string, saltHex: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(value), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: hexToBytes(saltHex), iterations, hash: 'SHA-256' }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

function bytesToHex(bytes: Uint8Array): string { return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''); }
function hexToBytes(hex: string): Uint8Array { const out = new Uint8Array(hex.length / 2); for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16); return out; }
async function randomHex(bytes = 16): Promise<string> { const data = new Uint8Array(bytes); crypto.getRandomValues(data); return bytesToHex(data); }

function scryptDerive(password: string, salt: Uint8Array, N: number, r: number, p: number, dkLen: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    nodeScrypt(Buffer.from(password, 'utf8'), Buffer.from(salt), dkLen, { N, r, p, maxmem: Math.max(32 * 1024 * 1024, 128 * N * r + 1024 * 1024) }, (error, derivedKey) => {
      if (error) reject(error); else resolve(new Uint8Array(derivedKey));
    });
  });
}

export async function verifyPassword(password: string, stored: string): Promise<{ valid: boolean; upgradedHash?: string }> {
  if (!password || !stored) return { valid: false };
  if (/^[a-f0-9]{64}$/i.test(stored)) {
    const legacy = await sha256(password);
    if (legacy !== stored.toLowerCase()) return { valid: false };
    const salt = await randomHex(16);
    const iterations = 310000;
    const derived = await pbkdf2(password, salt, iterations);
    return { valid: true, upgradedHash: `pbkdf2-sha256$${iterations}$${salt}$${derived}` };
  }
  const pbkdf2Match = /^pbkdf2-sha256\$(\d+)\$([a-f0-9]+)\$([a-f0-9]+)$/i.exec(stored);
  if (pbkdf2Match) {
    const iterations = Number(pbkdf2Match[1]);
    if (!Number.isSafeInteger(iterations) || iterations < 100000 || iterations > 1000000) return { valid: false };
    const derived = await pbkdf2(password, pbkdf2Match[3], iterations);
    return { valid: derived === pbkdf2Match[4].toLowerCase() };
  }
  const scryptMatch = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/.exec(stored);
  if (scryptMatch) {
    try {
      const N = Number(scryptMatch[1]); const r = Number(scryptMatch[2]); const p = Number(scryptMatch[3]);
      const salt = Buffer.from(scryptMatch[4], 'base64url'); const expected = Buffer.from(scryptMatch[5], 'base64url');
      const derived = await scryptDerive(password, salt, N, r, p, expected.length);
      if (derived.length !== expected.length) return { valid: false };
      let diff = 0; for (let i = 0; i < expected.length; i++) diff |= derived[i] ^ expected[i];
      if (diff !== 0) return { valid: false };
      const newSalt = await randomHex(16); const newDerived = await pbkdf2(password, newSalt, 310000);
      return { valid: true, upgradedHash: `pbkdf2-sha256$310000$${newSalt}$${newDerived}` };
    } catch { return { valid: false }; }
  }
  return { valid: false };
}

async function supabaseRequest(env: Env, path: string, init: RequestInit = {}) {
  const secret = getSecret(env);
  if (!secret) throw new Error('SUPABASE_SECRET_KEY is not configured for the production authentication function.');
  return fetch(`${getBaseUrl(env)}${path}`, { ...init, headers: { apikey: secret, Authorization: `Bearer ${secret}`, ...(init.headers || {}) } });
}

async function authRateKey(env: Env, request: Request, username: string): Promise<string> {
  const forwarded = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
  const secret = env.AUTH_RATE_LIMIT_SECRET || getSecret(env);
  return sha256(`${secret}:${forwarded}:${username.toLowerCase()}`);
}

export async function checkLoginRateLimit(env: Env, request: Request, username: string): Promise<boolean> {
  const keyHash = await authRateKey(env, request, username);
  const response = await supabaseRequest(env, '/rest/v1/rpc/check_auth_login_rate_limit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_key_hash: keyHash, p_max_attempts: LOGIN_MAX_ATTEMPTS, p_window_seconds: LOGIN_WINDOW_SECONDS, p_block_seconds: LOGIN_BLOCK_SECONDS })
  });
  if (!response.ok) throw new Error('Authentication rate limiter is unavailable.');
  return Boolean(await response.json());
}

export async function recordFailedLogin(env: Env, request: Request, username: string): Promise<void> {
  const keyHash = await authRateKey(env, request, username);
  await supabaseRequest(env, '/rest/v1/rpc/record_auth_login_failure', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_key_hash: keyHash, p_window_seconds: LOGIN_WINDOW_SECONDS, p_max_attempts: LOGIN_MAX_ATTEMPTS, p_block_seconds: LOGIN_BLOCK_SECONDS })
  });
}

export async function clearLoginRateLimit(env: Env, request: Request, username: string): Promise<void> {
  const keyHash = await authRateKey(env, request, username);
  await supabaseRequest(env, `/rest/v1/auth_login_attempts?key_hash=eq.${encodeURIComponent(keyHash)}`, { method: 'DELETE' }).catch(() => {});
}

export function getSessionToken(request: Request): string {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)__Host-solmint_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function createSession(env: Env, user: AuthUser): Promise<string> {
  const rawToken = `${await randomHex(32)}${await randomHex(32)}`;
  const tokenHash = await sha256(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  const response = await supabaseRequest(env, '/rest/v1/auth_sessions', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt }) });
  if (!response.ok) throw new Error(await response.text());
  return rawToken;
}

export function sessionCookie(token: string): string { return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`; }
export function clearSessionCookie(): string { return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`; }

export async function getAuthenticatedUser(env: Env, request: Request): Promise<AuthUser | null> {
  const token = getSessionToken(request); if (!token) return null;
  const tokenHash = await sha256(token);
  const response = await supabaseRequest(env, `/rest/v1/auth_sessions?select=user_id,expires_at&token_hash=eq.${encodeURIComponent(tokenHash)}&limit=1`);
  if (!response.ok) return null;
  const sessions = await response.json() as Array<{ user_id: string; expires_at: string }>;
  const session = sessions[0]; if (!session || Date.parse(session.expires_at) <= Date.now()) return null;
  const userResponse = await supabaseRequest(env, `/rest/v1/users?select=id,username,full_name,role,permissions,is_active,created_at&id=eq.${encodeURIComponent(session.user_id)}&limit=1`);
  if (!userResponse.ok) return null;
  const users = await userResponse.json() as AuthUser[]; const user = users[0];
  if (!user || user.is_active === false) return null;
  const sessionUpdate = await supabaseRequest(env, `/rest/v1/auth_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ last_seen_at: new Date().toISOString() }) });
  if (!sessionUpdate.ok) console.warn('Session last_seen_at update failed:', sessionUpdate.status);
  return user;
}

export async function destroySession(env: Env, request: Request): Promise<void> {
  const token = getSessionToken(request); if (!token) return;
  const tokenHash = await sha256(token);
  await supabaseRequest(env, `/rest/v1/auth_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}`, { method: 'DELETE' }).catch(() => {});
}

export async function findUser(env: Env, username: string): Promise<AuthUser & { password_hash: string } | null> {
  const response = await supabaseRequest(env, `/rest/v1/users?select=id,username,full_name,password_hash,role,permissions,is_active,created_at&username=eq.${encodeURIComponent(username)}&limit=1`);
  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json() as Array<AuthUser & { password_hash: string }>;
  return rows[0] || null;
}

export async function upgradePasswordHash(env: Env, userId: string, passwordHash: string): Promise<void> {
  await supabaseRequest(env, `/rest/v1/users?id=eq.${encodeURIComponent(userId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ password_hash: passwordHash }) });
}

export function toSafeUser(user: AuthUser) { return { id: user.id, username: user.username, fullName: user.full_name, role: user.role, permissions: Array.isArray(user.permissions) ? user.permissions : [], isActive: user.is_active, createdAt: user.created_at }; }
