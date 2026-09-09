import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  plugins: [usernameClient()],
});

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

export async function signOutAllAuthSessions(): Promise<void> {
  const operations = [
    authClient.signOut({}),
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    }),
  ];

  await Promise.allSettled(operations);
}
