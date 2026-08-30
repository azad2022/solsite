import * as ed25519 from '@noble/ed25519';
import { decodeBase58 } from './base58';

type WalletAddressKind = 'wallet' | 'token-account' | 'program-account' | 'invalid';

export interface SolanaAddressClassification {
  valid: boolean;
  kind: WalletAddressKind;
  existsOnChain: boolean;
  programOwner: string | null;
  tokenMint: string | null;
}

const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxEb';
const RPC_TIMEOUT_MS = 8_000;

async function getAccountInfo(rpcUrl: string, address: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method: 'getAccountInfo', params: [address, { encoding: 'jsonParsed', commitment: 'finalized' }] }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Solana RPC HTTP ${response.status}`);
    const payload = await response.json() as { result?: any; error?: { message?: string } };
    if (payload.error) throw new Error(payload.error.message || 'Solana RPC error.');
    return payload.result?.value ?? null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Classifies a public address for merchant receiving-wallet registration.
 *
 * An unfunded on-curve Ed25519 public key is a valid wallet address even when
 * no account exists yet. An existing token account is not a wallet address and
 * must not be stored as the merchant's canonical receiving wallet.
 */
export async function classifyMerchantReceivingAddress(address: string, rpcUrl: string): Promise<SolanaAddressClassification> {
  const normalized = address.trim();
  let publicKey: Uint8Array;
  try {
    publicKey = decodeBase58(normalized);
    if (publicKey.length !== 32) return { valid: false, kind: 'invalid', existsOnChain: false, programOwner: null, tokenMint: null };
    ed25519.Point.fromBytes(publicKey, false);
  } catch {
    return { valid: false, kind: 'invalid', existsOnChain: false, programOwner: null, tokenMint: null };
  }

  const account = await getAccountInfo(rpcUrl, normalized);
  if (!account) return { valid: true, kind: 'wallet', existsOnChain: false, programOwner: null, tokenMint: null };

  if (account.owner === SYSTEM_PROGRAM) return { valid: true, kind: 'wallet', existsOnChain: true, programOwner: SYSTEM_PROGRAM, tokenMint: null };

  if (account.owner === TOKEN_PROGRAM || account.owner === TOKEN_2022_PROGRAM) {
    const parsedType = account.data?.parsed?.type;
    const tokenMint = typeof account.data?.parsed?.info?.mint === 'string' ? account.data.parsed.info.mint : null;
    if (parsedType === 'account') return { valid: false, kind: 'token-account', existsOnChain: true, programOwner: account.owner, tokenMint };
  }

  return { valid: false, kind: 'program-account', existsOnChain: true, programOwner: typeof account.owner === 'string' ? account.owner : null, tokenMint: null };
}
