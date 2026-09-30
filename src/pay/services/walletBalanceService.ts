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

function positiveOrZeroIntegerString(value: unknown, name: string): string {
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
  return {
    asset,
    balanceAtomic: positiveOrZeroIntegerString(row.balanceAtomic, 'balanceAtomic'),
    decimals,
    mint,
  };
}

function parseSnapshot(value: unknown): PayWalletBalanceSnapshot {
  const row = record(value, 'Invalid wallet balance response.');
  if (typeof row.walletAddress !== 'string' || typeof row.observedAt !== 'string' || row.network !== 'solana-mainnet' || !Array.isArray(row.assets)) {
    throw new TypeError('Invalid wallet balance response.');
  }
  const assets = row.assets.map(parseAsset);
  const expected: PayWalletAsset[] = ['SOL', 'USDT', 'USDC'];
  if (expected.some((asset) => !assets.some((item) => item.asset === asset))) throw new TypeError('Incomplete wallet balance response.');
  return { walletAddress: row.walletAddress, network: 'solana-mainnet', observedAt: row.observedAt, assets };
}

export async function getMerchantWalletBalance(
  merchantId: string,
  client: PayHttpClient = defaultPayHttpClient,
): Promise<PayWalletBalanceSnapshot> {
  if (!merchantId.trim()) throw new TypeError('merchantId is required.');
  const payload = await client.request<WalletBalanceEnvelope>(`/api/pay/v1/merchants/${encodeURIComponent(merchantId)}/wallet-balance`);
  if (!payload.data) throw new TypeError('Invalid wallet balance response.');
  return parseSnapshot(payload.data);
}
