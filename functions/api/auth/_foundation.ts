export const BETTER_AUTH_BASE_PATH = '/api/auth';

export interface BetterAuthEnv {
  NODE_ENV?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
}

export interface BetterAuthFoundationConfig {
  secret: string;
  baseURL: string;
  trustedOrigins: string[];
}

function isDevelopment(env: BetterAuthEnv): boolean {
  return env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
}

function requireSecret(env: BetterAuthEnv): string {
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is required for the Better Auth boundary.');
  }
  if (secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
  }
  return secret;
}

function parseBaseURL(env: BetterAuthEnv): string {
  const raw = env.BETTER_AUTH_URL?.trim();
  if (!raw) {
    throw new Error('BETTER_AUTH_URL is required; auth must not infer its origin from untrusted proxy headers.');
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('BETTER_AUTH_URL must be a valid absolute URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('BETTER_AUTH_URL must use HTTP or HTTPS.');
  }
  if (url.username || url.password) {
    throw new Error('BETTER_AUTH_URL must not contain credentials.');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('BETTER_AUTH_URL must contain only the scheme, host, and optional port.');
  }

  const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (!isDevelopment(env) && url.protocol !== 'https:') {
    throw new Error('BETTER_AUTH_URL must use HTTPS outside development/test environments.');
  }
  if (!isDevelopment(env) && localhost) {
    throw new Error('BETTER_AUTH_URL must not point to localhost outside development/test environments.');
  }

  return url.origin;
}

function parseTrustedOrigins(env: BetterAuthEnv, baseURL: string): string[] {
  const configured = (env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const origins = [baseURL, ...configured];
  const normalized = origins.map((origin) => {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`BETTER_AUTH_TRUSTED_ORIGINS contains an invalid origin: ${origin}`);
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
      throw new Error(`BETTER_AUTH_TRUSTED_ORIGINS contains a non-origin value: ${origin}`);
    }
    const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    if (!isDevelopment(env) && (url.protocol !== 'https:' || localhost)) {
      throw new Error(`BETTER_AUTH_TRUSTED_ORIGINS contains a development-only origin: ${origin}`);
    }
    return url.origin;
  });

  return [...new Set(normalized)];
}

/**
 * Configuration-only foundation for the future Better Auth instance.
 * This module intentionally does not initialize a database adapter or auth handler.
 * That integration remains blocked until the Cloudflare -> PostgreSQL connectivity
 * path is explicitly selected and validated.
 */
export function getBetterAuthFoundationConfig(env: BetterAuthEnv): BetterAuthFoundationConfig {
  const secret = requireSecret(env);
  const baseURL = parseBaseURL(env);
  const trustedOrigins = parseTrustedOrigins(env, baseURL);
  return { secret, baseURL, trustedOrigins };
}
