import { createAuthClient } from 'better-auth/client';
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
