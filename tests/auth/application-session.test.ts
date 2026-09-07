import { describe, expect, it, vi } from 'vitest';

vi.mock('../../functions/api/auth/_instance', () => ({
  createBetterAuthRuntime: () => ({
    auth: { api: { getSession: vi.fn() } },
    database: { query: vi.fn(), end: vi.fn().mockResolvedValue(undefined) },
  }),
}));

import { getBetterAuthApplicationUser } from '../../functions/api/auth/_application-session';

describe('Better Auth application session boundary', () => {
  it('returns null when Better Auth has no session', async () => {
    const { createBetterAuthRuntime } = await import('../../functions/api/auth/_instance');
    const runtime = createBetterAuthRuntime({ NODE_ENV: 'test' } as never) as any;
    runtime.auth.api.getSession.mockResolvedValue(null);
    expect(await getBetterAuthApplicationUser(new Request('https://solmint.ir/'), { NODE_ENV: 'test' } as never)).toBeNull();
  });

  it('maps a Better Auth identity only through the server-side identity bridge', async () => {
    const { createBetterAuthRuntime } = await import('../../functions/api/auth/_instance');
    const runtime = createBetterAuthRuntime({ NODE_ENV: 'test' } as never) as any;
    runtime.auth.api.getSession.mockResolvedValue({ user: { id: 'ba-user-1', email: 'u@example.com', name: 'U', createdAt: new Date().toISOString() } });
    runtime.database.query.mockResolvedValue({ rows: [{ application_user_id: 'usr-1', username: 'user1', full_name: 'User One', role: 'user', permissions: [], is_active: true, created_at: new Date().toISOString() }] });
    const result = await getBetterAuthApplicationUser(new Request('https://solmint.ir/'), { NODE_ENV: 'test' } as never);
    expect(result).toMatchObject({ id: 'ba-user-1', username: 'user1', role: 'user', isActive: true });
    expect(runtime.database.query).toHaveBeenCalledTimes(1);
  });

  it('fails closed for inactive application users', async () => {
    const { createBetterAuthRuntime } = await import('../../functions/api/auth/_instance');
    const runtime = createBetterAuthRuntime({ NODE_ENV: 'test' } as never) as any;
    runtime.auth.api.getSession.mockResolvedValue({ user: { id: 'ba-user-2', email: 'u2@example.com', name: 'U2', createdAt: new Date().toISOString() } });
    runtime.database.query.mockResolvedValue({ rows: [{ application_user_id: 'usr-2', username: 'user2', full_name: 'User Two', role: 'admin', permissions: [], is_active: false, created_at: new Date().toISOString() }] });
    expect(await getBetterAuthApplicationUser(new Request('https://solmint.ir/'), { NODE_ENV: 'test' } as never)).toBeNull();
  });
});
