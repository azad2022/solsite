import type { Transaction } from '@solana/web3.js';

export type SolanaInjectedWalletId = 'phantom' | 'solflare' | 'backpack' | 'legacy';

export interface SolanaInjectedWalletProvider {
  readonly id: SolanaInjectedWalletId;
  readonly name: 'Phantom' | 'Solflare' | 'Backpack' | 'Solana Wallet';
  readonly provider: WalletProvider;
  readonly publicKey?: PublicKeyLike;
}

export interface WalletProvider {
  publicKey?: PublicKeyLike;
  connect?: () => Promise<{ publicKey?: PublicKeyLike | string } | void>;
  signAndSendTransaction?: (transaction: Transaction) => Promise<unknown>;
}

export interface PublicKeyLike {
  toBase58(): string;
}

export interface SolanaWalletGlobals {
  phantom?: { solana?: WalletProvider };
  solflare?: WalletProvider;
  backpack?: { solana?: WalletProvider };
  solana?: WalletProvider;
}

const CANDIDATES: ReadonlyArray<{
  id: SolanaInjectedWalletId;
  name: SolanaInjectedWalletProvider['name'];
  get: (globals: SolanaWalletGlobals) => WalletProvider | undefined;
}> = [
  { id: 'phantom', name: 'Phantom', get: (globals) => globals.phantom?.solana },
  { id: 'solflare', name: 'Solflare', get: (globals) => globals.solflare },
  { id: 'backpack', name: 'Backpack', get: (globals) => globals.backpack?.solana },
  { id: 'legacy', name: 'Solana Wallet', get: (globals) => globals.solana },
];

function asGlobals(value: unknown): SolanaWalletGlobals {
  return (value && typeof value === 'object') ? value as SolanaWalletGlobals : {};
}

function usable(provider: WalletProvider | undefined): provider is WalletProvider {
  return Boolean(provider && typeof provider.connect === 'function');
}

export function detectSolanaWalletProviders(globalsValue: unknown = typeof window !== 'undefined' ? window : undefined): SolanaInjectedWalletProvider[] {
  const globals = asGlobals(globalsValue);
  const seen = new Set<WalletProvider>();
  const result: SolanaInjectedWalletProvider[] = [];

  for (const candidate of CANDIDATES) {
    const provider = candidate.get(globals);
    if (!usable(provider) || seen.has(provider)) continue;
    seen.add(provider);
    result.push({ id: candidate.id, name: candidate.name, provider, publicKey: provider.publicKey });
  }

  return result;
}

export function getSolanaWalletProvider(id?: SolanaInjectedWalletId): SolanaInjectedWalletProvider | undefined {
  const providers = detectSolanaWalletProviders();
  if (!id) {
    return providers.find((item) => item.publicKey) ?? providers[0];
  }
  return providers.find((item) => item.id === id);
}

export function publicKeyString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && typeof (value as { toBase58?: unknown }).toBase58 === 'function') {
    return (value as { toBase58(): string }).toBase58().trim();
  }
  return '';
}
