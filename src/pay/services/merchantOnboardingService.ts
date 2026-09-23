import { defaultPayHttpClient, PayHttpError, type PayHttpClient } from '../http';

export interface PayMerchantReceivingWallet {
  id: string;
  address: string;
  network: 'solana';
  verificationStatus: 'unverified' | 'verified' | 'rejected';
  isActive: boolean;
  verifiedAt: string | null;
}

export interface PayMerchant {
  id: string;
  ownerUserId: string;
  businessName: string;
  slug: string;
  status: 'pending' | 'active' | 'suspended' | 'closed';
  createdAt: string;
  updatedAt: string;
  receivingWallet: PayMerchantReceivingWallet | null;
}

interface MerchantEnvelope {
  success?: boolean;
  merchant?: unknown;
  created?: boolean;
}

interface ChallengeEnvelope {
  success?: boolean;
  challenge?: unknown;
}

interface VerifyEnvelope {
  success?: boolean;
  verified?: boolean;
  merchantId?: string;
  walletId?: string;
  walletAddress?: string;
  verifiedAt?: string;
}

function parseMerchantReceivingWallet(value: unknown): PayMerchantReceivingWallet {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid merchant receiving wallet response.');
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    typeof row.address !== 'string' ||
    row.network !== 'solana' ||
    typeof row.verification_status !== 'string' ||
    !['unverified', 'verified', 'rejected'].includes(row.verification_status) ||
    row.is_active !== true ||
    (row.verified_at !== null && typeof row.verified_at !== 'string')
  ) {
    throw new TypeError('Invalid merchant receiving wallet response.');
  }
  return {
    id: row.id,
    address: row.address,
    network: 'solana',
    verificationStatus: row.verification_status as PayMerchantReceivingWallet['verificationStatus'],
    isActive: true,
    verifiedAt: row.verified_at as string | null,
  };
}

function parseMerchant(value: unknown): PayMerchant {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid merchant response.');
  const row = value as Record<string, unknown>;
  const status = row.status;
  const wallet = row.receiving_wallet;
  const parsedWallet = wallet == null ? null : parseMerchantReceivingWallet(wallet);
  if (
    typeof row.id !== 'string' ||
    typeof row.owner_user_id !== 'string' ||
    typeof row.business_name !== 'string' ||
    typeof row.slug !== 'string' ||
    typeof status !== 'string' ||
    !['pending', 'active', 'suspended', 'closed'].includes(status) ||
    typeof row.created_at !== 'string' ||
    typeof row.updated_at !== 'string'
  ) throw new TypeError('Invalid merchant response.');
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    businessName: row.business_name,
    slug: row.slug,
    status: status as PayMerchant['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    receivingWallet: parsedWallet,
  };
}

export async function getMyMerchant(
  client: PayHttpClient = defaultPayHttpClient,
  maxAttempts = 3,
): Promise<PayMerchant | null> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const payload = await client.request<MerchantEnvelope>('/api/pay/v1/merchants');
      if (payload.success !== true || payload.merchant == null) return null;
      return parseMerchant(payload.merchant);
    } catch (error) {
      lastError = error;
      if (error instanceof PayHttpError && error.status < 500) throw error;
      if (error instanceof TypeError && !(error instanceof PayHttpError)) throw error;
    }

    if (attempt < maxAttempts) {
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 150 * attempt));
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('Merchant lookup failed.');
}

export async function createMyMerchant(
  input: { businessName: string; slug: string },
  client: PayHttpClient = defaultPayHttpClient,
): Promise<PayMerchant> {
  const payload = await client.request<MerchantEnvelope>('/api/pay/v1/merchants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (payload.success !== true || !payload.merchant) throw new TypeError('Merchant creation returned an invalid response.');
  return parseMerchant(payload.merchant);
}

function parseChallenge(value: unknown): { id: string; message: string; walletAddress: string; expiresAt: string } {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid wallet challenge response.');
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.message !== 'string' || typeof row.walletAddress !== 'string' || typeof row.expiresAt !== 'string') {
    throw new TypeError('Invalid wallet challenge response.');
  }
  return { id: row.id, message: row.message, walletAddress: row.walletAddress, expiresAt: row.expiresAt };
}

export async function issueWalletChallenge(merchantId: string, walletAddress: string, client: PayHttpClient = defaultPayHttpClient) {
  const payload = await client.request<ChallengeEnvelope>(`/api/pay/v1/merchants/${encodeURIComponent(merchantId)}/wallet-challenges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  });
  if (payload.success !== true || !payload.challenge) throw new TypeError('Wallet challenge returned an invalid response.');
  return parseChallenge(payload.challenge);
}

export async function verifyWalletChallenge(
  merchantId: string,
  challengeId: string,
  walletAddress: string,
  signature: string,
  client: PayHttpClient = defaultPayHttpClient,
): Promise<VerifyEnvelope> {
  const payload = await client.request<VerifyEnvelope>(`/api/pay/v1/merchants/${encodeURIComponent(merchantId)}/wallet-challenges/${encodeURIComponent(challengeId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, signature }),
  });
  if (payload.success !== true || payload.verified !== true || payload.merchantId !== merchantId || payload.walletAddress !== walletAddress) {
    throw new TypeError('Wallet verification returned an invalid response.');
  }
  return payload;
}
