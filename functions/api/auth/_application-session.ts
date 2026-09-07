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
  applicationUserId: string;
  username: string;
  fullName: string;
  role: string;
  permissions: unknown[];
  isActive: true;
  createdAt: string;
}

type BetterAuthSessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  createdAt?: string | Date;
};

type ApplicationIdentityRow = {
  application_user_id: string;
  username: string | null;
  full_name: string | null;
  role: string | null;
  permissions: unknown;
  is_active: boolean | null;
  created_at: string | null;
};

/**
 * Extract the Better Auth session bearer from the server-only cookie.
 * This value must never be sent to browser storage or logged.
 */
export function getBetterAuthSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)(?:__Host-solmint_auth_session|solmint_auth_session)=([^;]+)/);
  if (!match) return null;
  try {
    const value = decodeURIComponent(match[1]).trim();
    return value || null;
  } catch {
    return null;
  }
}

/**
 * Pure mapping boundary used by the runtime and unit tests.
 * Better Auth owns the identity id; application data owns the Solmint profile/authorization fields.
 */
export function mapBetterAuthUserToApplicationUser(
  user: BetterAuthSessionUser,
  applicationUser: ApplicationIdentityRow | undefined,
): BetterAuthApplicationUser | null {
  if (!applicationUser || applicationUser.is_active === false || applicationUser.is_active == null) return null;

  return {
    id: String(user.id),
    applicationUserId: String(applicationUser.application_user_id),
    username: String(applicationUser.username || user.email || user.id),
    fullName: String(applicationUser.full_name || user.name || user.email || 'کاربر سولمینت'),
    role: applicationUser.role || 'user',
    permissions: Array.isArray(applicationUser.permissions) ? applicationUser.permissions : [],
    isActive: true,
    createdAt: applicationUser.created_at || new Date(user.createdAt || Date.now()).toISOString(),
  };
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

    const result = await runtime.database.query<ApplicationIdentityRow>(
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
      [String(session.user.id)],
    );

    return mapBetterAuthUserToApplicationUser(session.user, result.rows[0]);
  } finally {
    if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
      await runtime.database.end().catch(() => {});
    }
  }
}
