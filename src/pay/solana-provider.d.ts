import type { Transaction } from '@solana/web3.js';

declare global {
  interface SolanaProvider {
    signAndSendTransaction?: (transaction: Transaction) => Promise<
      string
      | { signature?: string | Uint8Array }
      | { signature?: { toString(): string } }
    >;
  }
}

export {};
