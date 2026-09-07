import { getBetterAuthApplicationUser, type BetterAuthApplicationSessionEnv, type BetterAuthApplicationUser } from '../../auth/_application-session';
import { PayRuntimeError } from './runtime';
import { mintPayInternalJwt, type PayInternalJwtEnv } from './internal-jwt';

export type PayIdentityEnv = BetterAuthApplicationSessionEnv & PayInternalJwtEnv & {
  SUPABASE_PUBLISHABLE_KEY?: string;
};

export interface PayIdentityContext {
  user: BetterAuthApplicationUser;
  accessToken: string;
}

export async function resolvePayIdentity(request: Request, env: PayIdentityEnv): Promise<PayIdentityContext> {
  const user = await getBetterAuthApplicationUser(request, env);
  if (!user || !user.isActive) {
    throw new PayRuntimeError('UNAUTHORIZED', 401, 'A valid SolMint session is required.');
  }

  let accessToken: string;
  try {
    accessToken = await mintPayInternalJwt(env, user.applicationUserId);
  } catch (error) {
    console.error(JSON.stringify({ scope: 'pay:identity-bridge', userId: user.applicationUserId, error: error instanceof Error ? error.message : 'signing_failed' }));
    throw new PayRuntimeError('AUTH_BRIDGE_MISCONFIGURED', 503, 'Pay authorization is temporarily unavailable.');
  }

  return { user, accessToken };
}

export function getSupabaseProjectApiKey(env: PayIdentityEnv): string {
  const key = env.SUPABASE_PUBLISHABLE_KEY?.trim() || env.SUPABASE_SECRET_KEY?.trim();
  if (!key) throw new PayRuntimeError('SERVER_MISCONFIGURED', 503, 'Pay data service is not configured.');
  return key;
}
