import { getAuthenticatedUser, jsonResponse } from '../../../../../auth/_shared';
import { PayRuntimeError, payFeatureEnabled, supabaseRequest } from '../../../../_shared/runtime';
import { buildWalletOwnershipMessage, validateChallengeWindow, verifySolanaWalletSignature } from '../../../../../../src/pay/services/walletSignature';

interface PayEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAY_API_ENABLED?: string;
  PAY_APP_ORIGIN?: string;
}

function requestId(): string { return `PAY-${crypto.randomUUID()}`; }
function validId(value: string): boolean { return /^[A-Za-z0-9_-]{1,128}$/.test(value); }

export const onRequestPost = async ({ request, env, params }: { request: Request; env: PayEnv; params: { merchantId: string; challengeId: string } }) => {
  const id = requestId();
  if (!payFeatureEnabled(env)) return jsonResponse({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.', requestId: id }, 404);

  try {
    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false) return jsonResponse({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.', requestId: id }, 401);

    const merchantId = String(params.merchantId || '');
    const challengeId = String(params.challengeId || '');
    if (!validId(merchantId) || !validId(challengeId)) return jsonResponse({ code: 'INVALID_IDENTIFIER', message: 'Merchant or challenge id is invalid.', requestId: id }, 400);

    const merchantResponse = await supabaseRequest(env, `/rest/v1/pay_merchants?select=id,owner_user_id,status&id=eq.${encodeURIComponent(merchantId)}&limit=1`, { headers: { Accept: 'application/json' } });
    const merchants = await merchantResponse.json() as Array<{ id: string; owner_user_id: string; status: string }>;
    const merchant = merchants[0];
    if (!merchant || merchant.owner_user_id !== user.id) return jsonResponse({ code: 'FORBIDDEN', message: 'You do not control this merchant account.', requestId: id }, 403);
    if (merchant.status === 'suspended' || merchant.status === 'closed') return jsonResponse({ code: 'MERCHANT_NOT_ACTIVE', message: 'Merchant is not available for wallet verification.', requestId: id }, 403);

    const challengeResponse = await supabaseRequest(env, `/rest/v1/pay_wallet_challenges?select=id,merchant_id,wallet_id,origin,challenge_message,issued_at,expires_at,consumed_at&id=eq.${encodeURIComponent(challengeId)}&merchant_id=eq.${encodeURIComponent(merchantId)}&limit=1`, { headers: { Accept: 'application/json' } });
    const challenges = await challengeResponse.json() as Array<{ id: string; merchant_id: string; wallet_id: string; origin: string; challenge_message: string; issued_at: string; expires_at: string; consumed_at: string | null }>;
    const challenge = challenges[0];
    if (!challenge) return jsonResponse({ code: 'CHALLENGE_NOT_FOUND', message: 'Wallet verification challenge was not found.', requestId: id }, 404);
    if (challenge.consumed_at) return jsonResponse({ code: 'CHALLENGE_ALREADY_USED', message: 'This wallet verification challenge has already been consumed.', requestId: id }, 409);
    if (!validateChallengeWindow(challenge.issued_at, challenge.expires_at)) return jsonResponse({ code: 'CHALLENGE_EXPIRED', message: 'This wallet verification challenge has expired.', requestId: id }, 410);

    const origin = env.PAY_APP_ORIGIN?.trim();
    if (!origin || challenge.origin !== origin) throw new PayRuntimeError('ORIGIN_MISMATCH', 500, 'Pay application origin is not configured consistently.');

    const walletResponse = await supabaseRequest(env, `/rest/v1/pay_merchant_wallets?select=id,merchant_id,wallet_role,address,verification_status,is_active&id=eq.${encodeURIComponent(challenge.wallet_id)}&merchant_id=eq.${encodeURIComponent(merchantId)}&limit=1`, { headers: { Accept: 'application/json' } });
    const wallets = await walletResponse.json() as Array<{ id: string; merchant_id: string; wallet_role: string; address: string; verification_status: string; is_active: boolean }>;
    const wallet = wallets[0];
    if (!wallet || wallet.wallet_role !== 'receiving') return jsonResponse({ code: 'WALLET_NOT_FOUND', message: 'Receiving wallet was not found.', requestId: id }, 404);

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const signatureBase58 = typeof body?.signature === 'string' ? body.signature.trim() : '';
    const walletAddress = typeof body?.walletAddress === 'string' ? body.walletAddress.trim() : '';
    if (!signatureBase58 || !walletAddress) return jsonResponse({ code: 'INVALID_PROOF', message: 'walletAddress and signature are required.', requestId: id }, 400);
    if (walletAddress !== wallet.address) return jsonResponse({ code: 'WALLET_MISMATCH', message: 'Signed wallet does not match the challenged wallet.', requestId: id }, 400);

    const expectedMessage = buildWalletOwnershipMessage({ origin, challengeId, merchantId, walletAddress: wallet.address, issuedAt: challenge.issued_at, expiresAt: challenge.expires_at });
    if (expectedMessage !== challenge.challenge_message) return jsonResponse({ code: 'CHALLENGE_TAMPERED', message: 'Wallet challenge data is inconsistent.', requestId: id }, 500);

    const signatureValid = await verifySolanaWalletSignature({ walletAddress, message: challenge.challenge_message, signatureBase58 });
    if (!signatureValid) return jsonResponse({ code: 'INVALID_SIGNATURE', message: 'Wallet signature could not be verified.', requestId: id }, 400);

    const consumeResponse = await supabaseRequest(env, '/rest/v1/rpc/pay_consume_wallet_challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_challenge_id: challengeId, p_user_id: user.id, p_verified_at: new Date().toISOString() }),
    });
    const result = await consumeResponse.json() as { ok?: boolean; reason?: string; merchant_id?: string; wallet_id?: string; address?: string; verified_at?: string };
    if (!result.ok) {
      if (result.reason === 'CHALLENGE_ALREADY_USED') return jsonResponse({ code: 'CHALLENGE_ALREADY_USED', message: 'This wallet verification challenge has already been consumed.', requestId: id }, 409);
      if (result.reason === 'CHALLENGE_EXPIRED') return jsonResponse({ code: 'CHALLENGE_EXPIRED', message: 'This wallet verification challenge has expired.', requestId: id }, 410);
      if (result.reason === 'MERCHANT_FORBIDDEN') return jsonResponse({ code: 'FORBIDDEN', message: 'You do not control this merchant account.', requestId: id }, 403);
      throw new PayRuntimeError('CHALLENGE_CONSUMPTION_FAILED', 503, 'Wallet verification could not be committed safely.');
    }

    return jsonResponse({ verified: true, merchantId: result.merchant_id, walletId: result.wallet_id, walletAddress: result.address, verifiedAt: result.verified_at, requestId: id }, 200);
  } catch (error) {
    if (error instanceof PayRuntimeError) return jsonResponse({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message, requestId: id }, error.status);
    console.error(JSON.stringify({ scope: 'pay:wallet-verify', requestId: id, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return jsonResponse({ code: 'INTERNAL_ERROR', message: 'Pay service is temporarily unavailable.', requestId: id }, 503);
  }
};
