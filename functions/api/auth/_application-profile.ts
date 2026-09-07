import type { ApplicationAuthDatabase } from './_database';

const UNUSABLE_LEGACY_PASSWORD_PREFIX = 'better-auth-only$';

interface BetterAuthUserRecord {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  createdAt: Date | string;
}

function normalizeApplicationUsername(user: BetterAuthUserRecord): string {
  const supplied = typeof user.username === 'string' ? user.username.trim().toLowerCase() : '';
  if (supplied) return supplied;

  return `user_${user.id.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24)}`.slice(0, 30);
}

function unusableLegacyPasswordMarker(): string {
  return `${UNUSABLE_LEGACY_PASSWORD_PREFIX}${crypto.randomUUID()}`;
}

export async function provisionApplicationProfile(
  database: ApplicationAuthDatabase,
  user: BetterAuthUserRecord,
): Promise<{ applicationUserId: string; source: 'native' | 'legacy-migration' }> {
  const username = normalizeApplicationUsername(user);
  const existing = await database.findApplicationUserByUsername(username);

  if (existing) {
    const existingLink = await database.findIdentityByApplicationUserId(existing.id);
    if (existingLink && existingLink.better_auth_user_id !== user.id) {
      throw new Error('Application identity is already linked to another Better Auth identity.');
    }

    await database.linkIdentity({
      betterAuthUserId: user.id,
      applicationUserId: existing.id,
      source: 'legacy-migration',
    });
    return { applicationUserId: existing.id, source: 'legacy-migration' };
  }

  const applicationUserId = `usr-${crypto.randomUUID()}`;
  const createdAt = user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt).toISOString();

  try {
    await database.createApplicationUser({
      id: applicationUserId,
      username,
      fullName: user.name.trim() || user.email,
      passwordHash: unusableLegacyPasswordMarker(),
      createdAt,
    });

    await database.linkIdentity({
      betterAuthUserId: user.id,
      applicationUserId,
      source: 'native',
    });
  } catch (error) {
    await database.deleteApplicationUser(applicationUserId).catch(() => {});
    throw error;
  }

  return { applicationUserId, source: 'native' };
}
