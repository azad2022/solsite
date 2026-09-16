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

export type PayAuthBridgeFailureCode =
  | 'AUTH_BRIDGE_CONFIG_INVALID'
  | 'AUTH_BRIDGE_PRIVATE_KEY_INVALID'
  | 'AUTH_BRIDGE_CRYPTO_FAILED'
  | 'AUTH_BRIDGE_RUNTIME_FAILED';

export function classifyPayAuthBridgeError(error: unknown): PayAuthBridgeFailureCode {
  const message = error instanceof Error ? error.message : '';
  if (/SUPABASE_INTERNAL_JWT_PRIVATE_KEY/i.test(message) || /PKCS#8 PEM/i.test(message) || /invalid base64 data/i.test(message)) {
    return 'AUTH_BRIDGE_PRIVATE_KEY_INVALID';
  }
  if (/SUPABASE_INTERNAL_JWT_(ALGORITHM|KEY_ID|ISSUER|AUDIENCE|TTL_SECONDS)|SUPABASE_URL/i.test(message)) {
    return 'AUTH_BRIDGE_CONFIG_INVALID';
  }
  if (/crypto|operationerror|data provided to an operation does not meet the requirements|importkey|subtle/i.test(message)) {
    return 'AUTH_BRIDGE_CRYPTO_FAILED';
  }
  return 'AUTH_BRIDGE_RUNTIME_FAILED';
}

export async function resolvePayIdentity(request: Request, env: PayIdentityEnv): Promise<PayIdentityContext> {
  const user = await getBetterAuthApplicationUser(request, env);
  if (!user || !user.isActive) throw new PayRuntimeError('UNAUTHORIZED', 401, 'A valid SolMint session is required.');

  try {
    const accessToken = await mintPayInternalJwt(env, user.applicationUserId);
    return { user, accessToken };
  } catch (error) {
    console.error(JSON.stringify({ scope: 'pay:identity-bridge', code: classifyPayAuthBridgeError(error), error: error instanceof Error ? error.message : 'signing_failed' }));
    throw new PayRuntimeError(classifyPayAuthBridgeError(error), 503, 'Pay authorization is temporarily unavailable.');
  }
}

export function getSupabaseProjectApiKey(env: PayIdentityEnv): string {
  const key = env.SUPABASE_PUBLISHABLE_KEY?.trim() || env.SUPABASE_SECRET_KEY?.trim();
  if (!key) throw new PayRuntimeError('SERVER_MISCONFIGURED', 503, 'Pay data service is not configured.');
  return key;
}

export async function supabaseRequestAsIdentity(
  env: PayIdentityEnv,
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const baseUrl = (env.SUPABASE_URL || 'https://nvopkbiedorfshwbmyhn.supabase.co').replace(/\/$/, '');
  const headers = new Headers(init.headers);
  headers.set('apikey', getSupabaseProjectApiKey(env));
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    const upstream = (await response.text()).slice(0, 500);
    console.error(JSON.stringify({ scope: 'pay:identity-postgrest', status: response.status, body: upstream }));
    throw new PayRuntimeError('UPSTREAM_DATABASE_ERROR', 503, 'Pay data service is unavailable.');
  }
  return response;
}
