import type { Transaction } from '@solana/web3.js';

interface SolanaWalletPublicKey {
  toBase58(): string;
}

interface SolanaWalletProvider {
  publicKey?: SolanaWalletPublicKey | null;
  connect(): Promise<{ publicKey?: SolanaWalletPublicKey | null } | null | void>;
  signAndSendTransaction?: (transaction: Transaction) => Promise<string | { signature?: string | Uint8Array } | { signature?: { toString(): string } }>;
}

interface SolanaProvider {
  signAndSendTransaction?: (transaction: Transaction) => Promise<string | { signature?: string | Uint8Array } | { signature?: { toString(): string } }>;
}

declare global {
  interface Window {
    solana?: SolanaWalletProvider;
  }
}

export {};
