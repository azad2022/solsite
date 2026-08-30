import { getAuthenticatedUser } from '../../../../../auth/_shared';
import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson, readJsonBody, supabaseRequest } from '../../../../_shared/runtime';
import { buildWalletOwnershipMessage, validateChallengeWindow, verifySolanaWalletSignature } from '../../../../../../src/pay/services/walletSignature';

interface PayEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PAY_API_ENABLED?: string;
  PAY_APP_ORIGIN?: string;
}

function originAllowed(request: Request, env: PayEnv): boolean {
  const expected = env.PAY_APP_ORIGIN?.trim();
  return !!expected && request.headers.get('Origin') === expected;
}

function validId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export const onRequestPost = async ({ request, env, params }: { request: Request; env: PayEnv; params: { merchantId: string; challengeId: string } }) => {
  const id = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, id);

  try {
    if (!originAllowed(request, env)) return payJson({ code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not trusted.' }, 403, id);

    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false) return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, id);

    const merchantId = String(params.merchantId || '');
    const challengeId = String(params.challengeId || '');
    if (!validId(merchantId) || !validId(challengeId)) return payJson({ code: 'INVALID_IDENTIFIER', message: 'Merchant or challenge id is invalid.' }, 400, id);

    const merchantResponse = await supabaseRequest(env, `/rest/v1/pay_merchants?select=id,owner_user_id,status&id=eq.${encodeURIComponent(merchantId)}&limit=1`, { headers: { Accept: 'application/json' } });
    const merchants = await merchantResponse.json() as Array<{ id: string; owner_user_id: string; status: string }>;
    const merchant = merchants[0];
    if (!merchant || merchant.owner_user_id !== user.id) return payJson({ code: 'FORBIDDEN', message: 'You do not control this merchant account.' }, 403, id);
    if (merchant.status === 'suspended' || merchant.status === 'closed') return payJson({ code: 'MERCHANT_NOT_ACTIVE', message: 'Merchant is not available for wallet verification.' }, 403, id);

    const challengeResponse = await supabaseRequest(env, `/rest/v1/pay_wallet_challenges?select=id,merchant_id,wallet_address,message,issued_at,expires_at,consumed_at,status&id=eq.${encodeURIComponent(challengeId)}&merchant_id=eq.${encodeURIComponent(merchantId)}&limit=1`, { headers: { Accept: 'application/json' } });
    const challenges = await challengeResponse.json() as Array<{ id: string; merchant_id: string; wallet_address: string; message: string; issued_at: string; expires_at: string; consumed_at: string | null; status: string }>;
    const challenge = challenges[0];
    if (!challenge) return payJson({ code: 'CHALLENGE_NOT_FOUND', message: 'Wallet verification challenge was not found.' }, 404, id);
    if (challenge.consumed_at || challenge.status !== 'issued') return payJson({ code: 'CHALLENGE_ALREADY_USED', message: 'This wallet verification challenge has already been consumed.' }, 409, id);
    if (!validateChallengeWindow(challenge.issued_at, challenge.expires_at)) return payJson({ code: 'CHALLENGE_EXPIRED', message: 'This wallet verification challenge has expired.' }, 410, id);

    const origin = env.PAY_APP_ORIGIN?.trim();
    if (!origin) throw new PayRuntimeError('SERVER_MISCONFIGURED', 503, 'Pay application origin is not configured.');
    const body = await readJsonBody(request);
    const signatureBase58 = typeof body.signature === 'string' ? body.signature.trim() : '';
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : '';
    if (!signatureBase58 || !walletAddress) return payJson({ code: 'INVALID_PROOF', message: 'walletAddress and signature are required.' }, 400, id);
    if (walletAddress !== challenge.wallet_address) return payJson({ code: 'WALLET_MISMATCH', message: 'Signed wallet does not match the challenged wallet.' }, 400, id);

    const expectedMessage = buildWalletOwnershipMessage({ origin, challengeId, merchantId, walletAddress: challenge.wallet_address, issuedAt: challenge.issued_at, expiresAt: challenge.expires_at });
    if (expectedMessage !== challenge.message) return payJson({ code: 'CHALLENGE_TAMPERED', message: 'Wallet challenge data is inconsistent.' }, 500, id);

    const signatureValid = await verifySolanaWalletSignature({ walletAddress, message: challenge.message, signatureBase58 });
    if (!signatureValid) return payJson({ code: 'INVALID_SIGNATURE', message: 'Wallet signature could not be verified.' }, 400, id);

    const consumeResponse = await supabaseRequest(env, '/rest/v1/rpc/pay_consume_wallet_challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_challenge_id: challengeId, p_user_id: user.id, p_signature_base58: signatureBase58, p_signer_public_key: walletAddress, p_verified_at: new Date().toISOString() }),
    });
    const result = await consumeResponse.json() as { ok?: boolean; reason?: string; merchant_id?: string; wallet_id?: string; address?: string; verified_at?: string };
    if (!result.ok) {
      if (result.reason === 'CHALLENGE_ALREADY_USED') return payJson({ code: 'CHALLENGE_ALREADY_USED', message: 'This wallet verification challenge has already been consumed.' }, 409, id);
      if (result.reason === 'CHALLENGE_EXPIRED') return payJson({ code: 'CHALLENGE_EXPIRED', message: 'This wallet verification challenge has expired.' }, 410, id);
      if (result.reason === 'MERCHANT_FORBIDDEN') return payJson({ code: 'FORBIDDEN', message: 'You do not control this merchant account.' }, 403, id);
      throw new PayRuntimeError('CHALLENGE_CONSUMPTION_FAILED', 503, 'Wallet verification could not be committed safely.');
    }

    return payJson({ verified: true, merchantId: result.merchant_id, walletId: result.wallet_id, walletAddress: result.address, verifiedAt: result.verified_at }, 200, id);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, id);
    console.error(JSON.stringify({ scope: 'pay:wallet-verify', requestId: id, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'INTERNAL_ERROR', message: 'Pay service is temporarily unavailable.' }, 503, id);
  }
};
