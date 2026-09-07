import { createBetterAuthRuntime } from './_instance';
import type { Env } from './_shared';

export type BetterAuthApplicationSessionEnv = Env & {
  NODE_ENV?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  BETTER_AUTH_DATABASE_URL?: string;
  HYPERDRIVE?: { connectionString: string };
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
};

export interface BetterAuthApplicationUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  permissions: unknown[];
  isActive: true;
  createdAt: string;
}

/**
 * Authentication boundary for application routes.
 * Better Auth owns identity/session state; public.users remains authoritative for
 * application profile, role, permissions, and active status.
 */
export async function getBetterAuthApplicationUser(
  request: Request,
  env: BetterAuthApplicationSessionEnv,
): Promise<BetterAuthApplicationUser | null> {
  const runtime = createBetterAuthRuntime(env);
  try {
    const session = await runtime.auth.api.getSession({ headers: request.headers });
    if (!session?.user) return null;

    const user = session.user;
    const result = await runtime.database.query<{
      application_user_id: string;
      username: string | null;
      full_name: string | null;
      role: string | null;
      permissions: unknown;
      is_active: boolean | null;
      created_at: string | null;
    }>(
      `select l.application_user_id,
              u.username,
              u.full_name,
              u.role,
              u.permissions,
              u.is_active,
              u.created_at
       from public.auth_identity_links l
       join public.users u on u.id = l.application_user_id
       where l.better_auth_user_id = $1
       limit 1`,
      [String(user.id)],
    );

    const applicationUser = result.rows[0];
    if (!applicationUser || applicationUser.is_active === false || applicationUser.is_active == null) return null;

    return {
      id: String(user.id),
      username: String(applicationUser.username || user.email || user.id),
      fullName: String(applicationUser.full_name || user.name || user.email || 'کاربر سولمینت'),
      role: applicationUser.role || 'user',
      permissions: Array.isArray(applicationUser.permissions) ? applicationUser.permissions : [],
      isActive: true,
      createdAt: applicationUser.created_at || new Date(user.createdAt).toISOString(),
    };
  } finally {
    if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
      await runtime.database.end().catch(() => {});
    }
  }
}
