import { getAuthenticatedUser } from '../../../../auth/_shared';
import { PayRuntimeError, makePayRequestId, payFeatureEnabled, payJson, readJsonBody, supabaseRequest } from '../../../_shared/runtime';
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

function originAllowed(request: Request, env: PayEnv): boolean {
  const expected = env.PAY_APP_ORIGIN?.trim();
  return !!expected && request.headers.get('Origin') === expected;
}

function validMerchantId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const onRequestPost = async ({ request, env, params }: { request: Request; env: PayEnv; params: { merchantId: string } }) => {
  const id = makePayRequestId();
  if (!payFeatureEnabled(env)) return payJson({ code: 'PAY_API_DISABLED', message: 'Pay API is not enabled.' }, 404, id);

  try {
    if (!originAllowed(request, env)) return payJson({ code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not trusted.' }, 403, id);

    const user = await getAuthenticatedUser(env, request);
    if (!user || user.is_active === false) return payJson({ code: 'UNAUTHORIZED', message: 'A valid SolMint session is required.' }, 401, id);

    const merchantId = String(params.merchantId || '');
    if (!validMerchantId(merchantId)) return payJson({ code: 'INVALID_MERCHANT_ID', message: 'Merchant id is invalid.' }, 400, id);
    if (!env.SOLANA_RPC_URL || !/^https:\/\//i.test(env.SOLANA_RPC_URL)) throw new PayRuntimeError('SERVER_MISCONFIGURED', 503, 'Solana RPC is not configured.');
    const origin = env.PAY_APP_ORIGIN?.trim();
    if (!origin || !/^https:\/\//i.test(origin)) throw new PayRuntimeError('SERVER_MISCONFIGURED', 503, 'Pay application origin is not configured.');

    const merchantResponse = await supabaseRequest(env, `/rest/v1/pay_merchants?select=id,owner_user_id,status&id=eq.${encodeURIComponent(merchantId)}&limit=1`, { headers: { Accept: 'application/json' } });
    const merchants = await merchantResponse.json() as Array<{ id: string; owner_user_id: string; status: string }>;
    const merchant = merchants[0];
    if (!merchant || merchant.owner_user_id !== user.id) return payJson({ code: 'FORBIDDEN', message: 'You do not control this merchant account.' }, 403, id);
    if (merchant.status === 'suspended' || merchant.status === 'closed') return payJson({ code: 'MERCHANT_NOT_ACTIVE', message: 'Merchant is not available for wallet verification.' }, 403, id);

    const body = await readJsonBody(request);
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : '';
    if (!walletAddress) return payJson({ code: 'INVALID_WALLET_ADDRESS', message: 'walletAddress is required.' }, 400, id);

    const classification = await classifyMerchantReceivingAddress(walletAddress, env.SOLANA_RPC_URL);
    if (!classification.valid || classification.kind !== 'wallet') return payJson({ code: 'INVALID_RECEIVING_WALLET', message: 'The address is not a valid Solana receiving wallet.' }, 400, id);

    const existingResponse = await supabaseRequest(env, `/rest/v1/pay_merchant_wallets?select=id,verification_status,is_active&merchant_id=eq.${encodeURIComponent(merchantId)}&wallet_role=eq.receiving&address=eq.${encodeURIComponent(walletAddress)}&limit=1`, { headers: { Accept: 'application/json' } });
    const existing = await existingResponse.json() as Array<{ id: string; verification_status: string; is_active: boolean }>;
    if (existing[0]?.verification_status === 'verified' && existing[0].is_active) return payJson({ code: 'WALLET_ALREADY_VERIFIED', message: 'This receiving wallet is already verified.' }, 409, id);

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
    const challengeId = crypto.randomUUID();
    const message = buildWalletOwnershipMessage({ origin, challengeId, merchantId, walletAddress, issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString() });
    if (!validateChallengeWindow(issuedAt.toISOString(), expiresAt.toISOString(), issuedAt.getTime() + 1)) throw new PayRuntimeError('CHALLENGE_INVALID', 500, 'Challenge window could not be created.');
    const nonceHash = await sha256Hex(message);

    const challengeResponse = await supabaseRequest(env, '/rest/v1/rpc/pay_issue_wallet_challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_merchant_id: merchantId, p_user_id: user.id, p_wallet_address: walletAddress, p_message: message, p_nonce_hash: nonceHash, p_issued_at: issuedAt.toISOString(), p_expires_at: expiresAt.toISOString() }),
    });
    const challenge = await challengeResponse.json() as { id?: string; message?: string; wallet_address?: string; issued_at?: string; expires_at?: string };
    if (!challenge.id) throw new PayRuntimeError('CHALLENGE_CREATION_FAILED', 503, 'Wallet challenge could not be created safely.');

    return payJson({ challenge: { id: challenge.id, message: challenge.message, walletAddress: challenge.wallet_address, issuedAt: challenge.issued_at, expiresAt: challenge.expires_at } }, 201, id);
  } catch (error) {
    if (error instanceof PayRuntimeError) return payJson({ code: error.code, message: error.status >= 500 ? 'Pay service is temporarily unavailable.' : error.message }, error.status, id);
    console.error(JSON.stringify({ scope: 'pay:wallet-challenge', requestId: id, error: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }));
    return payJson({ code: 'INTERNAL_ERROR', message: 'Pay service is temporarily unavailable.' }, 503, id);
  }
};
