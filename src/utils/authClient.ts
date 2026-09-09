import { useEffect, useState } from 'react';
import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';
import type { UserAccount } from '../types';

export const authClient = createAuthClient({
  plugins: [usernameClient()],
});

type SafeApplicationUser = Omit<UserAccount, 'passwordHash'>;
type ApplicationUserResponse = { success?: boolean; user?: unknown };
type BetterAuthSessionSnapshot = {
  data: { user?: { id?: string } } | null;
  isPending: boolean;
  error: unknown;
};

async function parseApplicationUser(response: Response): Promise<SafeApplicationUser | null> {
  const payload = (await response.json().catch(() => null)) as ApplicationUserResponse | null;
  if (!response.ok || payload?.success !== true || !payload.user || typeof payload.user !== 'object') return null;

  const value = payload.user as Record<string, unknown>;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  if (!id) return null;

  const role = typeof value.role === 'string' ? value.role : 'user';
  if (!['superadmin', 'admin', 'editor', 'writer', 'user'].includes(role)) return null;

  const permissions = Array.isArray(value.permissions) && value.permissions.every((item) => typeof item === 'string')
    ? value.permissions as UserAccount['permissions']
    : undefined;

  return {
    id,
    username: typeof value.username === 'string' ? value.username : '',
    fullName: typeof value.fullName === 'string' ? value.fullName : '',
    role: role as UserAccount['role'],
    permissions,
    isActive: value.isActive !== false,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
  };
}

export async function fetchApplicationUser(fetchImpl: typeof fetch = fetch): Promise<Response> {
  return fetchImpl('/api/users/me', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
}

export async function fetchApplicationUserWithRetry(maxAttempts = 3): Promise<Response> {
  let lastResponse: Response | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchApplicationUser();
      lastResponse = response;
      if (response.ok || response.status === 401) return response;
    } catch {
      // A transient network/runtime failure must not permanently leave the UI anonymous.
    }

    if (attempt < maxAttempts) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 250 * attempt));
    }
  }

  return lastResponse ?? new Response(null, { status: 503 });
}

export function useApplicationSession(): {
  user: SafeApplicationUser | null;
  isPending: boolean;
  error: Error | null;
} {
  const session = authClient.useSession() as unknown as BetterAuthSessionSnapshot;
  const [user, setUser] = useState<SafeApplicationUser | null>(null);
  const [applicationPending, setApplicationPending] = useState(true);
  const [applicationError, setApplicationError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (session.isPending) {
      setApplicationPending(true);
      return () => { cancelled = true; };
    }

    if (!session.data?.user) {
      setUser(null);
      setApplicationError(null);
      setApplicationPending(false);
      return () => { cancelled = true; };
    }

    setApplicationPending(true);
    setApplicationError(null);
    void fetchApplicationUserWithRetry().then(async (response) => {
      const resolvedUser = await parseApplicationUser(response);
      if (cancelled) return;
      if (response.ok && resolvedUser && resolvedUser.isActive !== false && resolvedUser.createdAt) {
        setUser(resolvedUser);
        setApplicationError(null);
      } else {
        setUser(null);
        setApplicationError(response.status >= 500 ? new Error('Application identity service is unavailable.') : null);
      }
      setApplicationPending(false);
    }).catch((error) => {
      if (cancelled) return;
      setUser(null);
      setApplicationError(error instanceof Error ? error : new Error('Application identity service is unavailable.'));
      setApplicationPending(false);
    });

    return () => { cancelled = true; };
  }, [session.data?.user?.id, session.isPending]);

  return {
    user,
    isPending: session.isPending || applicationPending,
    error: session.error instanceof Error ? session.error : applicationError,
  };
}

export async function signOutAllAuthSessions(): Promise<void> {
  try {
    await authClient.signOut({});
  } finally {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    }).catch(() => undefined);
  }
}
