import type { PaymentAsset, TokenProgram } from '../types/domain';

export interface SupportedAssetConfig {
  asset: PaymentAsset;
  tokenMint: string | null;
  tokenProgram: TokenProgram | null;
  decimals: number | null;
}

export interface StablecoinAssetConfig {
  mint?: string;
  decimals?: string;
}

/**
 * Resolve immutable on-chain metadata for a supported asset from server-side
 * configuration. The checkout client must never choose token program/decimals.
 */
export function resolveSupportedAssetConfig(asset: PaymentAsset, config: StablecoinAssetConfig): SupportedAssetConfig {
  if (asset === 'SOL') return { asset, tokenMint: null, tokenProgram: null, decimals: null };

  const tokenMint = config.mint?.trim() || '';
  const decimals = Number(config.decimals?.trim() || '');
  if (!tokenMint || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error(`${asset} is not configured with a valid mint and decimals.`);
  }

  // The first SolMint Pay release supports USDC/USDT on Solana's original
  // Token Program only. Token-2022 remains represented in the domain model but
  // is intentionally rejected until its mint/extension policy is separately
  // reviewed. This avoids accidentally accepting transfer-tax or hook behavior.
  return { asset, tokenMint, tokenProgram: 'spl-token', decimals };
}

export function resolveAssetFromEnvironment(asset: PaymentAsset, env: Record<string, string | undefined>): SupportedAssetConfig {
  return resolveSupportedAssetConfig(asset, {
    mint: asset === 'USDC' ? env.PAY_USDC_MINT : env.PAY_USDT_MINT,
    decimals: asset === 'USDC' ? env.PAY_USDC_DECIMALS : env.PAY_USDT_DECIMALS,
  });
}
