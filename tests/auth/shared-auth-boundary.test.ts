import { describe, expect, it, vi } from 'vitest';

vi.mock('../../functions/api/auth/_application-session', () => ({
  getBetterAuthApplicationUser: vi.fn(),
}));

import { getBetterAuthApplicationUser } from '../../functions/api/auth/_application-session';
import { getAuthenticatedUser } from '../../functions/api/auth/_shared';

describe('shared authentication boundary', () => {
  it('maps Better Auth identity to the application user id for legacy callers', async () => {
    vi.mocked(getBetterAuthApplicationUser).mockResolvedValue({
      id: 'ba-user-1',
      applicationUserId: 'usr-123',
      username: 'alice',
      fullName: 'Alice',
      role: 'admin',
      permissions: ['articles'],
      isActive: true,
      createdAt: '2026-09-07T00:00:00.000Z',
    });

    const request = new Request('https://solmint.ir/api/test', {
      headers: { Cookie: '__Host-solmint_auth_session=opaque-session' },
    });

    const user = await getAuthenticatedUser({ NODE_ENV: 'test' } as never, request);

    expect(user).toMatchObject({
      id: 'usr-123',
      username: 'alice',
      role: 'admin',
      permissions: ['articles'],
      is_active: true,
    });
  });

  it('fails closed when a Better Auth cookie is present but its application identity is invalid', async () => {
    vi.mocked(getBetterAuthApplicationUser).mockResolvedValue(null);

    const request = new Request('https://solmint.ir/api/test', {
      headers: { Cookie: '__Host-solmint_auth_session=invalid' },
    });

    expect(await getAuthenticatedUser({ NODE_ENV: 'test' } as never, request)).toBeNull();
  });
});
