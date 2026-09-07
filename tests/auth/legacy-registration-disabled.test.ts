import { describe, expect, it } from 'vitest';
import { onRequestPost } from '../../functions/api/users/register';

describe('legacy registration retirement', () => {
  it('rejects the legacy public registration endpoint', async () => {
    const response = await onRequestPost({
      request: new Request('https://solmint.ir/api/users/register', { method: 'POST' }),
      env: {},
    } as never);

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({ code: 'LEGACY_REGISTRATION_DISABLED' });
  });
});
