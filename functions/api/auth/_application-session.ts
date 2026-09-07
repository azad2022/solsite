import { createBetterAuthRuntime } from './_instance';
import type { Env } from './_shared';

export type BetterAuthApplicationSessionEnv = Env & {
  NODE_ENV?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  BETTER_AUTH_DATABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
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
  id: string;
  username: string | null;
  full_name: string | null;
  role: string | null;
  permissions: unknown;
  is_active: boolean | null;
  created_at: string | null;
};

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

export function mapBetterAuthUserToApplicationUser(
  user: BetterAuthSessionUser,
  applicationUser: ApplicationIdentityRow | undefined,
): BetterAuthApplicationUser | null {
  if (!applicationUser || applicationUser.is_active === false || applicationUser.is_active == null) return null;

  return {
    id: String(user.id),
    applicationUserId: String(applicationUser.id),
    username: String(applicationUser.username || user.email || user.id),
    fullName: String(applicationUser.full_name || user.name || user.email || 'کاربر سولمینت'),
    role: applicationUser.role || 'user',
    permissions: Array.isArray(applicationUser.permissions) ? applicationUser.permissions : [],
    isActive: true,
    createdAt: applicationUser.created_at || new Date(user.createdAt || Date.now()).toISOString(),
  };
}

export async function getBetterAuthApplicationUser(
  request: Request,
  env: BetterAuthApplicationSessionEnv,
): Promise<BetterAuthApplicationUser | null> {
  const runtime = createBetterAuthRuntime(env);
  try {
    const session = await runtime.auth.api.getSession({ headers: request.headers });
    if (!session?.user) return null;

    const applicationUser = await runtime.application.findIdentityByBetterAuthUserId(String(session.user.id));
    return mapBetterAuthUserToApplicationUser(session.user, applicationUser ?? undefined);
  } finally {
    await runtime.close().catch(() => {});
  }
}
