import { enforcePayRateLimit, hashCanonicalRequest, makePayRequestId, payFeatureEnabled, payJson, PayRuntimeError } from '../../../_shared/runtime';
import { resolvePayIdentity, supabaseRequestAsIdentity, type PayIdentityEnv } from '../../../_shared/identity';

interface PayEnv extends PayIdentityEnv {
  PAY_API_ENABLED?: string;
  SOLANA_RPC_URL?: string;
  PAY_USDC_MINT?: string;
  PAY_USDC_DECIMALS?: string;
  PAY_USDT_MINT?: string;
  PAY_USDT_DECIMALS?: string;
}

type AssetCode = 'SOL' | 'USDT' | 'USDC';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function validUuid(value: string): boolean { return UUID.test(value); }

function parseDecimals(value: string | undefined, asset: Exclude<AssetCode, 'SOL'>): number {
  const decimals = Number(value?.trim() || '');
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new PayRuntimeError('ASSET_CONFIGURATION_INVALID', 503, `${asset} decimals are not configured.`);
  }
  return decimals;
}

function parseMint(value: string | undefined, asset: Exclude<AssetCode, 'SOL'>): string {
  const mint = value?.trim() || '';
  if (!mint || !ADDRESS.test(mint)) {
    throw new PayRuntimeError('ASSET_CONFIGURATION_INVALID', 503, `${asset} mint is not configured.`);
  }
  return mint;
}

async function rpc<T>(env: PayEnv, method: string, params: unknown[]): Promise<T> {
  const endpoint = env.SOLANA_RPC_URL?.trim();
  if (!endpoint || !/^https:\/\//i.test(endpoint)) throw new PayRuntimeError('SERVER_MISCONFIGURED', 503, 'SolMint Pay RPC is not configured.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new PayRuntimeError('RPC_UNAVAILABLE', 503, 'Solana balance service is unavailable.');
    const payload = await response.json() as { result?: T; error?: unknown };
    if (payload.error || payload.result === undefined) throw new PayRuntimeError('RPC_UNAVAILABLE', 503, 'Solana balance service is unavailable.');
    return payload.result;
  } finally {
    clearTimeout(timer);
  }
}

async function getSolBalanceAtomic(env: PayEnv, walletAddress: string): Promise<string> {
  const result = await rpc<{ value?: number }>(env, 'getBalance', [walletAddress, { commitment: 'confirmed' }]);
  if (!Number.isSafeInteger(result.value) || (result.value as number) < 0) throw new PayRuntimeError('RPC_RESPONSE_INVALID', 503, 'Solana balance response is invalid.');
  return String(result.value);
}

async function getTokenBalanceAtomic(env: PayEnv, walletAddress: string, mint: string): Promise<string> {
  const result = await rpc<{ value?: Array<{ account?: { data?: { parsed?: { info?: { tokenAmount?: { amount?: unknown } } } } } }> }>(
    env,
    'getTokenAccountsByOwner',
    [walletAddress, { mint }, { encoding: 'jsonParsed', commitment: 'confirmed' }],
  );
  const rows = Array.isArray(result.value) ? result.value : [];
  let total = 0n;
  for (const row of rows) {
    const amount = row.account?.data?.parsed?.info?.tokenAmount?.amount;
    if (typeof amount !== 'string' || !/^\d+$/.test(amount)) throw new PayRuntimeError('RPC_RESPONSE_INVALID', 503, 'Token balance response is invalid.');
    total += BigInt(amount);
  }
  return total.toString();
}

export const onRequestGet = async ({
  request,
  env,
  params,
}: {
  request: Request;
  env: PayEnv;
  params: { merchantId?: string };
}) => {
  const requestId = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, requestId);

  try {
    const merchantId = String(params?.merchantId || '').trim();
    if (!validUuid(merchantId)) return payJson({ code: 'INVALID_MERCHANT_ID', message: 'merchantId is invalid.' }, 400, requestId);

    const identity = await resolvePayIdentity(request, env);
    const subjectHash = await hashCanonicalRequest({ userId: identity.user.applicationUserId, merchantId });
    await enforcePayRateLimit(env, 'pay:wallet-balance', subjectHash, 60, 30);

    const merchantResponse = await supabaseRequestAsIdentity(
      env,
      identity.accessToken,
      `/rest/v1/pay_merchants?select=id,status&id=eq.${encodeURIComponent(merchantId)}&limit=1`,
    );
    const merchants = await merchantResponse.json() as Array<{ id: string; status: string }>;
    const merchant = merchants[0];
    if (!merchant) return payJson({ code: 'MERCHANT_NOT_FOUND', message: 'Merchant was not found.' }, 404, requestId);
    if (merchant.status === 'closed') return payJson({ code: 'MERCHANT_UNAVAILABLE', message: 'Merchant is not available.' }, 409, requestId);

    const walletResponse = await supabaseRequestAsIdentity(
      env,
      identity.accessToken,
      `/rest/v1/pay_merchant_wallets?select=id,address,network,wallet_role,is_active,verification_status&merchant_id=eq.${encodeURIComponent(merchantId)}&wallet_role=eq.receiving&is_active=eq.true&verification_status=eq.verified&limit=1`,
    );
    const wallets = await walletResponse.json() as Array<{
      id: string;
      address: string;
      network: string;
      wallet_role: string;
      is_active: boolean;
      verification_status: string;
    }>;
    const wallet = wallets[0];
    if (!wallet || !ADDRESS.test(wallet.address) || wallet.network !== 'solana') {
      return payJson({ code: 'RECEIVING_WALLET_NOT_READY', message: 'A verified receiving wallet is not available.' }, 409, requestId);
    }

    const usdcMint = parseMint(env.PAY_USDC_MINT, 'USDC');
    const usdtMint = parseMint(env.PAY_USDT_MINT, 'USDT');
    const usdcDecimals = parseDecimals(env.PAY_USDC_DECIMALS, 'USDC');
    const usdtDecimals = parseDecimals(env.PAY_USDT_DECIMALS, 'USDT');

    const [solAtomic, usdtAtomic, usdcAtomic] = await Promise.all([
      getSolBalanceAtomic(env, wallet.address),
      getTokenBalanceAtomic(env, wallet.address, usdtMint),
      getTokenBalanceAtomic(env, wallet.address, usdcMint),
    ]);

    return payJson({
      data: {
        walletAddress: wallet.address,
        network: 'solana-mainnet',
        observedAt: new Date().toISOString(),
        assets: [
          { asset: 'SOL', balanceAtomic: solAtomic, decimals: 9, mint: null },
          { asset: 'USDT', balanceAtomic: usdtAtomic, decimals: usdtDecimals, mint: usdtMint },
          { asset: 'USDC', balanceAtomic: usdcAtomic, decimals: usdcDecimals, mint: usdcMint },
        ],
      },
    }, 200, requestId);
  } catch (error) {
    if (error instanceof PayRuntimeError) {
      return payJson({ code: error.code, message: error.status >= 500 ? 'Wallet balance is temporarily unavailable.' : error.message }, error.status, requestId);
    }
    console.error(JSON.stringify({ scope: 'pay:wallet-balance', requestId, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'WALLET_BALANCE_UNAVAILABLE', message: 'Wallet balance is temporarily unavailable.' }, 503, requestId);
  }
};
