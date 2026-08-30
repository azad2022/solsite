import { getAuthenticatedUser, jsonResponse } from '../../../../auth/_shared';
import { PayRuntimeError, payFeatureEnabled, supabaseRequest } from '../../../_shared/runtime';
import { buildWalletOwnershipMessage, validateChallengeWindow } from '../../../../../../src/pay/services/walletSignature';
import { classifyMerchantReceivingAddress } from '../../../../../../src/pay/services/walletAddressVerifier';

interface PayEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAY_API_ENABLED?: string;
  PAY_APP_ORIGIN?: string;
  SOLANA_RPC_URL?: string;
}

const CHALLENGE_TTL_MS = 10 * 60 * 1000;

function requestId(): string { return `PAY-${crypto.randomUUID()}`; }
function validMerchantId(value: string): boolean { return /^[A-Za-z0-9_-]{1,128}$/.test(value); }

export const onRequestPost = async ({ request, env, params }: { request: Request; env: PayEnv; params: { merchantId: string } }) => {
  const id = requestId();
  if (!payFeatureEnabled(env)) return jsonResponse({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.', requestId: id }, 404);

  try {
    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false) return jsonResponse({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.', requestId: id }, 401);
    const merchantId = String(params.merchantId || '');
    if (!validMerchantId(merchantId)) return jsonResponse({ code: 'INVALID_MERCHANT_ID', message: 'Merchant id is invalid.', requestId: id }, 400);
    if (!env.SOLANA_RPC_URL || !/^https:\/\//i.test(env.SOLANA_RPC_URL)) throw new PayRuntimeError('SERVER_MISCONFIGURED', 503, 'Solana RPC is not configured.');
    const origin = env.PAY_APP_ORIGIN?.trim();
    if (!origin || !/^https:\/\//i.test(origin)) throw new PayRuntimeError('SERVER_MISCONFIGURED', 503, 'Pay application origin is not configured.');

    const merchantResponse = await supabaseRequest(env, `/rest/v1/pay_merchants?select=id,owner_user_id,status&id=eq.${encodeURIComponent(merchantId)}&limit=1`, { headers: { Accept: 'application/json' } });
    const merchants = await merchantResponse.json() as Array<{ id: string; owner_user_id: string; status: string }>;
    const merchant = merchants[0];
    if (!merchant || merchant.owner_user_id !== user.id) return jsonResponse({ code: 'FORBIDDEN', message: 'You do not control this merchant account.', requestId: id }, 403);
    if (merchant.status === 'suspended' || merchant.status === 'closed') return jsonResponse({ code: 'MERCHANT_NOT_ACTIVE', message: 'Merchant is not available for wallet verification.', requestId: id }, 403);

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const walletAddress = typeof body?.walletAddress === 'string' ? body.walletAddress.trim() : '';
    if (!walletAddress) return jsonResponse({ code: 'INVALID_WALLET_ADDRESS', message: 'walletAddress is required.', requestId: id }, 400);

    const classification = await classifyMerchantReceivingAddress(walletAddress, env.SOLANA_RPC_URL);
    if (!classification.valid || classification.kind !== 'wallet') {
      return jsonResponse({ code: 'INVALID_RECEIVING_WALLET', message: 'The address is not a valid Solana receiving wallet.', requestId: id }, 400);
    }

    const existingResponse = await supabaseRequest(env, `/rest/v1/pay_merchant_wallets?select=id,verification_status,is_active&merchant_id=eq.${encodeURIComponent(merchantId)}&wallet_role=eq.receiving&address=eq.${encodeURIComponent(walletAddress)}&limit=1`, { headers: { Accept: 'application/json' } });
    const existing = await existingResponse.json() as Array<{ id: string; verification_status: string; is_active: boolean }>;
    let walletId = existing[0]?.id;
    if (!walletId) {
      const walletResponse = await supabaseRequest(env, '/rest/v1/pay_merchant_wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ merchant_id: merchantId, wallet_role: 'receiving', address: walletAddress, verification_status: 'pending', is_active: true }),
      });
      const wallets = await walletResponse.json() as Array<{ id: string }>;
      walletId = wallets[0]?.id;
      if (!walletId) throw new PayRuntimeError('WALLET_CREATION_FAILED', 503, 'Receiving wallet could not be registered safely.');
    } else if (existing[0].verification_status === 'verified' && existing[0].is_active) {
      return jsonResponse({ code: 'WALLET_ALREADY_VERIFIED', message: 'This receiving wallet is already verified.', requestId: id }, 409);
    }

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
    const challengeId = crypto.randomUUID();
    const message = buildWalletOwnershipMessage({
      origin,
      challengeId,
      merchantId,
      walletAddress,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
    if (!validateChallengeWindow(issuedAt.toISOString(), expiresAt.toISOString(), issuedAt.getTime() + 1)) throw new PayRuntimeError('CHALLENGE_INVALID', 500, 'Challenge window could not be created.');

    await supabaseRequest(env, `/rest/v1/pay_wallet_challenges?wallet_id=eq.${encodeURIComponent(walletId)}&consumed_at=is.null`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ consumed_at: issuedAt.toISOString() }),
    });

    const challengeResponse = await supabaseRequest(env, '/rest/v1/pay_wallet_challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ id: challengeId, merchant_id: merchantId, wallet_id: walletId, origin, challenge_message: message, issued_at: issuedAt.toISOString(), expires_at: expiresAt.toISOString() }),
    });
    const created = await challengeResponse.json() as Array<{ id: string }>;
    if (!created[0]) throw new PayRuntimeError('CHALLENGE_CREATION_FAILED', 503, 'Wallet challenge could not be created safely.');

    return jsonResponse({ challenge: { id: challengeId, message, walletAddress, issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString() }, requestId: id }, 201);
  } catch (error) {
    if (error instanceof PayRuntimeError) return jsonResponse({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message, requestId: id }, error.status);
    console.error(JSON.stringify({ scope: 'pay:wallet-challenge', requestId: id, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return jsonResponse({ code: 'INTERNAL_ERROR', message: 'Pay service is temporarily unavailable.', requestId: id }, 503);
  }
};
