import type { PaymentAsset, TokenProgram } from '../types/domain';

export interface SupportedAssetConfig {
  asset: PaymentAsset;
  tokenMint: string | null;
  tokenProgram: TokenProgram | null;
  decimals: number | null;
}

/**
 * Resolve immutable on-chain metadata for a supported asset from server-side
 * configuration. The checkout client must never choose token program/decimals.
 */
export function resolveSupportedAssetConfig(
  asset: PaymentAsset,
  env: Record<string, string | undefined>,
): SupportedAssetConfig {
  if (asset === 'SOL') return { asset, tokenMint: null, tokenProgram: null, decimals: null };

  const prefix = asset === 'USDC' ? 'PAY_USDC_' : 'PAY_USDT_';
  const tokenMint = env[`${prefix}MINT`]?.trim() || '';
  const rawDecimals = env[`${prefix}DECIMALS`]?.trim() || '';
  const decimals = Number(rawDecimals);
  if (!tokenMint || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error(`${asset} is not configured with a valid mint and decimals.`);
  }

  // The first SolMint Pay release supports USDC/USDT on Solana's original
  // Token Program only. Token-2022 remains represented in the domain model but
  // is intentionally rejected until its mint/extension policy is separately
  // reviewed. This avoids accidentally accepting transfer-tax or hook behavior.
  return {
    asset,
    tokenMint,
    tokenProgram: 'spl-token',
    decimals,
  };
}
