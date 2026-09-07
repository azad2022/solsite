import { getBetterAuthApplicationUser, type BetterAuthApplicationSessionEnv, type BetterAuthApplicationUser } from '../auth/_application-session';

export type PayMerchantMembership = {
  merchantId: string;
  applicationUserId: string;
  role: string;
};

export type PayMerchantAuthorization = {
  user: BetterAuthApplicationUser;
  membership: PayMerchantMembership;
};

type MembershipRow = {
  merchant_id: string;
  user_id: string;
  role: string;
  status: string;
};

function supabaseServerConfig(env: BetterAuthApplicationSessionEnv): { base: string; headers: Record<string, string> } | null {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const url = env.SUPABASE_URL;
  if (!key || !url) return null;
  return {
    base: url.replace(/\/$/, ''),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function findActiveMembership(
  config: { base: string; headers: Record<string, string> },
  merchantId: string,
  applicationUserId: string,
): Promise<MembershipRow | null> {
  const params = new URLSearchParams({
    select: 'merchant_id,user_id,role,status',
    merchant_id: `eq.${merchantId}`,
    user_id: `eq.${applicationUserId}`,
    status: 'eq.active',
    limit: '1',
  });

  const response = await fetch(`${config.base}/rest/v1/pay_merchant_members?${params.toString()}`, {
    method: 'GET',
    headers: { ...config.headers, 'Cache-Control': 'no-store' },
  });

  if (!response.ok) throw new Error(`Pay merchant authorization lookup failed with ${response.status}`);
  const rows = await response.json() as MembershipRow[];
  return rows[0] ?? null;
}

export type PayMerchantAuthorizationFailure = {
  ok: false;
  status: 401 | 403 | 404 | 503;
  code: 'PAY_AUTH_REQUIRED' | 'PAY_MERCHANT_FORBIDDEN' | 'PAY_MERCHANT_NOT_FOUND' | 'PAY_AUTH_MISCONFIGURED';
};

export async function authorizePayMerchant(
  request: Request,
  env: BetterAuthApplicationSessionEnv,
  merchantId: string,
): Promise<{ ok: true; value: PayMerchantAuthorization } | PayMerchantAuthorizationFailure> {
  if (!isUuid(merchantId)) return { ok: false, status: 404, code: 'PAY_MERCHANT_NOT_FOUND' };

  const user = await getBetterAuthApplicationUser(request, env);
  if (!user) return { ok: false, status: 401, code: 'PAY_AUTH_REQUIRED' };

  const config = supabaseServerConfig(env);
  if (!config) return { ok: false, status: 503, code: 'PAY_AUTH_MISCONFIGURED' };

  try {
    const membership = await findActiveMembership(config, merchantId, user.applicationUserId);
    if (!membership) return { ok: false, status: 403, code: 'PAY_MERCHANT_FORBIDDEN' };

    return {
      ok: true,
      value: {
        user,
        membership: {
          merchantId: membership.merchant_id,
          applicationUserId: membership.user_id,
          role: membership.role,
        },
      },
    };
  } catch (error) {
    console.error('Pay merchant authorization failed:', error instanceof Error ? error.message : 'unknown error');
    return { ok: false, status: 503, code: 'PAY_AUTH_MISCONFIGURED' };
  }
}
