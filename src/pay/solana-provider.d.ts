import type { Transaction } from '@solana/web3.js';

interface SolanaProvider {
  signAndSendTransaction?: (transaction: Transaction) => Promise<
    string
    | { signature?: string | Uint8Array }
    | { signature?: { toString(): string } }
  >;
}

export {};
