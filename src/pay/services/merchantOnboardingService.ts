import { defaultPayHttpClient } from '../http';

export interface PayMerchant {
  id: string;
  ownerUserId: string;
  businessName: string;
  slug: string;
  status: 'pending' | 'active' | 'suspended' | 'closed';
  createdAt: string;
  updatedAt: string;
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

function parseMerchant(value: unknown): PayMerchant {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid merchant response.');
  const row = value as Record<string, unknown>;
  const status = row.status;
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
  };
}

export async function getMyMerchant(): Promise<PayMerchant | null> {
  const payload = await defaultPayHttpClient.request<MerchantEnvelope>('/api/pay/v1/merchants');
  if (payload.success !== true || payload.merchant == null) return null;
  return parseMerchant(payload.merchant);
}

export async function createMyMerchant(input: { businessName: string; slug: string }): Promise<PayMerchant> {
  const payload = await defaultPayHttpClient.request<MerchantEnvelope>('/api/pay/v1/merchants', {
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

export async function issueWalletChallenge(merchantId: string, walletAddress: string) {
  const payload = await defaultPayHttpClient.request<ChallengeEnvelope>(`/api/pay/v1/merchants/${encodeURIComponent(merchantId)}/wallet-challenges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  });
  if (payload.success !== true || !payload.challenge) throw new TypeError('Wallet challenge returned an invalid response.');
  return parseChallenge(payload.challenge);
}

export async function verifyWalletChallenge(merchantId: string, challengeId: string, walletAddress: string, signature: string): Promise<VerifyEnvelope> {
  const payload = await defaultPayHttpClient.request<VerifyEnvelope>(`/api/pay/v1/merchants/${encodeURIComponent(merchantId)}/wallet-challenges/${encodeURIComponent(challengeId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, signature }),
  });
  if (payload.success !== true || payload.verified !== true || payload.merchantId !== merchantId || payload.walletAddress !== walletAddress) {
    throw new TypeError('Wallet verification returned an invalid response.');
  }
  return payload;
}
