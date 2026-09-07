import { scrypt as nodeScrypt } from 'node:crypto';

export interface Env {
  NODE_ENV?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
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

export const SESSION_COOKIE = '__Host-solmint_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 8;
export const MAX_SESSIONS_PER_USER = 5;

const textEncoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function randomHex(bytes: number): Promise<string> {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return toHex(values);
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return toHex(new Uint8Array(digest));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await randomHex(16);
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(password, salt, 32, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<{ valid: boolean; upgradedHash?: string }> {
  if (!stored) return { valid: false };

  const parts = stored.split('$');
  if (parts[0] === 'scrypt' && parts.length === 3) {
    const [, salt, expectedHex] = parts;
    try {
      const derivedKey = await new Promise<Buffer>((resolve, reject) => {
        nodeScrypt(password, salt, 32, (error, key) => {
          if (error) reject(error);
          else resolve(key as Buffer);
        });
      });
      const actualHex = derivedKey.toString('hex');
      return { valid: actualHex === expectedHex };
    } catch {
      return { valid: false };
    }
  }

  if (parts[0] === 'pbkdf2' && parts.length === 4) {
    const [, iterationsText, salt, expectedHex] = parts;
    const iterations = Number(iterationsText);
    if (!Number.isInteger(iterations) || iterations < 1) return { valid: false };
    const derived = await crypto.subtle.importKey('raw', textEncoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: textEncoder.encode(salt), iterations }, derived, 256);
    const actualHex = toHex(new Uint8Array(bits));
    if (actualHex !== expectedHex) return { valid: false };
    if (iterations >= 100_000) return { valid: true };
    const upgraded = await hashPassword(password);
    return { valid: true, upgradedHash: upgraded };
  }

  if (/^[a-f0-9]{64}$/i.test(stored)) {
    const valid = (await sha256(password)).toLowerCase() === stored.toLowerCase();
    return valid ? { valid: true, upgradedHash: await hashPassword(password) } : { valid: false };
  }

  return { valid: false };
}

export async function supabaseRequest(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const base = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) throw new Error('Supabase server configuration is missing.');
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  headers.set('Accept', 'application/json');
  return fetch(`${base}${path}`, { ...init, headers });
}

export async function checkLoginRateLimit(env: Env, request: Request, username: string): Promise<boolean> {
  void env;
  void request;
  void username;
  return true;
}

export async function recordFailedLogin(env: Env, request: Request, username: string): Promise<void> {
  void env;
  void request;
  void username;
}

export async function clearLoginRateLimit(env: Env, request: Request, username: string): Promise<void> {
  void env;
  void request;
  void username;
}

function getSessionToken(request: Request): string {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)__Host-solmint_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function enforceSessionLimit(env: Env, userId: string): Promise<void> {
  try {
    const response = await supabaseRequest(env, `/rest/v1/auth_sessions?select=id,created_at&user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc`);
    const sessions = (await response.json()) as Array<{ id: string; created_at: string }>;
    if (sessions.length >= MAX_SESSIONS_PER_USER) {
      const deleteCount = sessions.length - (MAX_SESSIONS_PER_USER - 1);
      for (const s of sessions.slice(0, deleteCount)) await supabaseRequest(env, `/rest/v1/auth_sessions?id=eq.${encodeURIComponent(s.id)}`, { method: 'DELETE' }).catch(() => {});
    }
  } catch (error) { console.warn('Session limit enforcement failed:', error); }
}

export async function createSession(env: Env, user: AuthUser): Promise<string> {
  const rawToken = `${await randomHex(32)}${await randomHex(32)}`;
  const tokenHash = await sha256(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await enforceSessionLimit(env, user.id);
  await supabaseRequest(env, '/rest/v1/auth_sessions', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt }) });
  return rawToken;
}

export function sessionCookie(token: string): string { return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`; }
export function clearSessionCookie(): string { return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`; }

async function getLegacyAuthenticatedUser(env: Env, request: Request): Promise<AuthUser | null> {
  const token = getSessionToken(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  let response: Response;
  try { response = await supabaseRequest(env, `/rest/v1/auth_sessions?select=user_id,expires_at&token_hash=eq.${encodeURIComponent(tokenHash)}&limit=1`); } catch { return null; }
  const sessions = (await response.json()) as Array<{ user_id: string; expires_at: string }>;
  const session = sessions[0];
  if (!session || Date.parse(session.expires_at) <= Date.now()) return null;
  let userResponse: Response;
  try { userResponse = await supabaseRequest(env, `/rest/v1/users?select=id,username,full_name,role,permissions,is_active,created_at&id=eq.${encodeURIComponent(session.user_id)}&limit=1`); } catch { return null; }
  const users = (await userResponse.json()) as AuthUser[];
  const user = users[0];
  if (!user || user.is_active === false) return null;
  await supabaseRequest(env, `/rest/v1/auth_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ last_seen_at: new Date().toISOString() }) }).catch(() => console.warn('Session last_seen_at update failed'));
  return user;
}

export interface BetterAuthApplicationResolverUser {
  id: string;
  applicationUserId: string;
  username: string;
  fullName: string;
  role: string;
  permissions: unknown[];
  isActive: true;
  createdAt: string;
}

type BetterAuthApplicationResolver = (request: Request, env: Env) => Promise<BetterAuthApplicationResolverUser | null>;

/**
 * Shared application authentication boundary.
 * Better Auth is authoritative whenever a Better Auth session cookie is present.
 * The legacy session is used only when that cookie is absent, allowing controlled
 * user migration without permitting an invalid Better Auth cookie to fall through.
 */
export async function getAuthenticatedUser(
  env: Env,
  request: Request,
  betterAuthResolver: BetterAuthApplicationResolver = async (resolverRequest, resolverEnv) => {
    const { getBetterAuthApplicationUser } = await import('./_application-session');
    return getBetterAuthApplicationUser(resolverRequest, resolverEnv as never);
  },
): Promise<AuthUser | null> {
  const cookie = request.headers.get('Cookie') || '';
  const hasBetterAuthCookie = /(?:^|;\s*)(?:__Host-solmint_auth_session|solmint_auth_session)=/.test(cookie);

  if (hasBetterAuthCookie) {
    try {
      const user = await betterAuthResolver(request, env);
      if (!user) return null;
      return {
        id: user.applicationUserId,
        username: user.username,
        full_name: user.fullName,
        role: user.role,
        permissions: user.permissions,
        is_active: user.isActive,
        created_at: user.createdAt,
      };
    } catch (error) {
      console.error('Better Auth application-session validation failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  return getLegacyAuthenticatedUser(env, request);
}

export async function destroySession(env: Env, request: Request): Promise<void> {
  const token = getSessionToken(request);
  if (!token) return;
  const tokenHash = await sha256(token);
  await supabaseRequest(env, `/rest/v1/auth_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}`, { method: 'DELETE' }).catch(() => {});
}

export async function findUser(env: Env, username: string): Promise<(AuthUser & { password_hash: string }) | null> {
  const response = await supabaseRequest(env, `/rest/v1/users?select=id,username,full_name,password_hash,role,permissions,is_active,created_at&username=eq.${encodeURIComponent(username)}&limit=1`);
  const rows = (await response.json()) as Array<AuthUser & { password_hash: string }>;
  return rows[0] || null;
}

export async function upgradePasswordHash(env: Env, userId: string, passwordHash: string): Promise<void> {
  await supabaseRequest(env, `/rest/v1/users?id=eq.${encodeURIComponent(userId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ password_hash: passwordHash }) });
}

export function toSafeUser(user: AuthUser) {
  return { id: user.id, username: user.username, fullName: user.full_name, role: user.role, permissions: Array.isArray(user.permissions) ? user.permissions : [], isActive: user.is_active, createdAt: user.created_at };
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}
