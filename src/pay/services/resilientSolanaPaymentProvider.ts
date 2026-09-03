import type { ObservedPaymentTransaction, SolanaCommitment } from './verificationPolicy';
import type { SolanaPaymentProvider } from './blockchainProvider';
import { createSolanaRpcProvider } from './solanaRpcProvider';

const MAX_PROVIDERS = 3;
const MAX_ATTEMPTS_PER_PROVIDER = 2;
const RETRY_BACKOFF_MS = [250, 750] as const;

class ResilientSolanaPaymentProvider implements SolanaPaymentProvider {
  constructor(private readonly providers: readonly SolanaPaymentProvider[]) {
    if (providers.length === 0) throw new Error('At least one Solana payment provider is required.');
    if (providers.length > MAX_PROVIDERS) throw new Error(`At most ${MAX_PROVIDERS} Solana payment providers are supported.`);
  }

  private async withRetry<T>(provider: SolanaPaymentProvider, operation: () => Promise<T>): Promise<T> {
    let lastError: unknown = new Error('Provider operation failed.');
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_PROVIDER; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt + 1 < MAX_ATTEMPTS_PER_PROVIDER) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS[attempt]));
        }
      }
    }
    void provider;
    throw lastError;
  }

  private async firstSuccessful<T>(operation: (provider: SolanaPaymentProvider) => Promise<T>): Promise<T> {
    let lastError: unknown = new Error('All Solana providers failed.');
    for (const provider of this.providers) {
      try {
        return await this.withRetry(provider, () => operation(provider));
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  async getTransaction(signature: string, commitment: SolanaCommitment): Promise<ObservedPaymentTransaction | null> {
    return await this.firstSuccessful((provider) => provider.getTransaction(signature, commitment));
  }

  async findTransactionsByReference(
    reference: string,
    commitment: SolanaCommitment,
    window?: { createdAt: string; expiresAt: string },
  ): Promise<readonly ObservedPaymentTransaction[]> {
    return await this.firstSuccessful((provider) => provider.findTransactionsByReference(reference, commitment, window));
  }

  async getHealth(): Promise<{ ok: boolean; slot: number | null; provider: string }> {
    let last: { ok: boolean; slot: number | null; provider: string } = { ok: false, slot: null, provider: 'none' };
    for (const provider of this.providers) {
      try {
        const health = await this.withRetry(provider, () => provider.getHealth());
        if (health.ok) return health;
        last = health;
      } catch {
        // Continue to the next configured provider. All failures remain closed below.
      }
    }
    return last;
  }
}

export function createResilientSolanaPaymentProvider(
  env: { SOLANA_RPC_URL?: string; SOLANA_RPC_FALLBACK_URLS?: string },
  expectedAssetMints: Partial<Record<'USDC' | 'USDT', string>> = {},
): SolanaPaymentProvider {
  const urls = [
    env.SOLANA_RPC_URL?.trim(),
    ...(env.SOLANA_RPC_FALLBACK_URLS || '').split(',').map((value) => value.trim()),
  ].filter((value): value is string => Boolean(value));

  const uniqueUrls = [...new Set(urls)];
  if (uniqueUrls.length === 0 || uniqueUrls.length > MAX_PROVIDERS) {
    throw new Error(`Configure between 1 and ${MAX_PROVIDERS} unique HTTPS Solana RPC URLs.`);
  }

  return new ResilientSolanaPaymentProvider(uniqueUrls.map((url) => createSolanaRpcProvider(
    { SOLANA_RPC_URL: url },
    expectedAssetMints,
  )));
}
