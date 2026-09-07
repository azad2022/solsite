import { PayHttpError } from '../http';

export interface PaySessionUser {
  readonly id: string;
  readonly username?: string;
  readonly fullName?: string;
  readonly email?: string;
  readonly role?: string;
  readonly permissions?: readonly string[];
  readonly isActive: boolean;
}

interface SessionEnvelope {
  success: boolean;
  user?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`Invalid auth session field: ${name}`);
  return value;
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredString(value, name);
}

function parseUser(value: unknown): PaySessionUser {
  if (!isRecord(value)) throw new TypeError('Invalid authenticated user response.');
  const permissions = value.permissions === undefined || value.permissions === null
    ? undefined
    : Array.isArray(value.permissions) ? value.permissions.map(item => requiredString(item, 'permissions[]')) : (() => { throw new TypeError('Invalid auth session field: permissions'); })();
  if (typeof value.isActive !== 'boolean') throw new TypeError('Invalid auth session field: isActive');

  return {
    id: requiredString(value.id, 'id'),
    username: optionalString(value.username, 'username'),
    fullName: optionalString(value.fullName, 'fullName'),
    email: optionalString(value.email, 'email'),
    role: optionalString(value.role, 'role'),
    permissions,
    isActive: value.isActive,
  };
}

export async function getPaySessionUser(fetchImpl: typeof fetch = fetch): Promise<PaySessionUser | null> {
  const response = await fetchImpl('/api/users/me', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  const payload = (await response.json().catch(() => null)) as SessionEnvelope | null;
  if (response.status === 401) return null;
  if (!response.ok) throw new PayHttpError('Authentication service is temporarily unavailable.', response.status);
  if (!payload || payload.success !== true || payload.user === undefined) {
    throw new TypeError('Invalid authentication session response envelope.');
  }
  return parseUser(payload.user);
}
