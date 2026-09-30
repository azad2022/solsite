import { defaultPayHttpClient, type PayHttpClient } from '../http';

export type PayWalletAsset = 'SOL' | 'USDT' | 'USDC';

export interface PayWalletBalanceAsset {
  asset: PayWalletAsset;
  balanceAtomic: string;
  decimals: number;
  mint: string | null;
}

export interface PayWalletBalanceSnapshot {
  walletAddress: string;
  network: 'solana-mainnet';
  observedAt: string;
  assets: readonly PayWalletBalanceAsset[];
}

interface WalletBalanceEnvelope { data?: unknown; }

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(message);
  return value as Record<string, unknown>;
}

function atomicString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new TypeError(`Invalid wallet balance field: ${name}`);
  return value;
}

function parseAsset(value: unknown): PayWalletBalanceAsset {
  const row = record(value, 'Invalid wallet balance asset.');
  const asset = row.asset;
  if (asset !== 'SOL' && asset !== 'USDT' && asset !== 'USDC') throw new TypeError('Unsupported wallet balance asset.');
  const decimals = row.decimals;
  if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new TypeError('Invalid wallet balance decimals.');
  const mint = row.mint;
  if (mint !== null && typeof mint !== 'string') throw new TypeError('Invalid wallet balance mint.');
  return { asset, balanceAtomic: atomicString(row.balanceAtomic, 'balanceAtomic'), decimals, mint };
}

function parseSnapshot(value: unknown): PayWalletBalanceSnapshot {
  const row = record(value, 'Invalid wallet balance response.');
  const walletAddress = row.walletAddress;
  const observedAt = row.observedAt;
  const network = row.network;
  const assetsValue = row.assets;
  if (typeof walletAddress !== 'string' || typeof observedAt !== 'string' || network !== 'solana-mainnet' || !Array.isArray(assetsValue)) {
    throw new TypeError('Invalid wallet balance response.');
  }
  const assets = assetsValue.map(parseAsset);
  for (const expected of ['SOL','USDT','USDC'] as const) {
    if (!assets.some(item => item.asset === expected)) throw new TypeError('Incomplete wallet balance response.');
  }
  return { walletAddress, network: 'solana-mainnet', observedAt, assets };
}

export async function getMerchantWalletBalance(merchantId: string, client: PayHttpClient = defaultPayHttpClient): Promise<PayWalletBalanceSnapshot> {
  const normalized = merchantId.trim();
  if (!normalized) throw new TypeError('merchantId is required.');
  const payload = await client.request<WalletBalanceEnvelope>(`/api/pay/v1/merchants/${encodeURIComponent(normalized)}/wallet-balance`);
  if (!payload.data) throw new TypeError('Invalid wallet balance response.');
  return parseSnapshot(payload.data);
}
