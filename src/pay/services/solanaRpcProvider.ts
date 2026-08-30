import type { ObservedPaymentTransaction, ObservedTransfer, SolanaCommitment } from './verificationPolicy';
import type { SolanaPaymentProvider } from './blockchainProvider';

const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const RPC_TIMEOUT_MS = 8_000;

interface RpcEnv {
  SOLANA_RPC_URL?: string;
}

type RpcResponse<T> = { result?: T; error?: { code?: number; message?: string } };

function commitmentValue(value: SolanaCommitment): string {
  return value === 'finalized' ? 'finalized' : 'confirmed';
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Solana RPC HTTP ${response.status}`);
    const payload = await response.json() as RpcResponse<T>;
    if (payload.error) throw new Error(payload.error.message || `Solana RPC error ${payload.error.code ?? 'unknown'}`);
    if (payload.result === undefined) throw new Error('Solana RPC returned no result.');
    return payload.result;
  } finally {
    clearTimeout(timer);
  }
}

function toAtomic(value: unknown, decimals: number): string | null {
  if (typeof value === 'number' || typeof value === 'string') {
    const normalized = String(value);
    if (/^\d+$/.test(normalized)) return normalized;
    if (/^\d+\.\d+$/.test(normalized)) {
      const [whole, fraction] = normalized.split('.');
      if (fraction.length > decimals) return null;
      return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals));
    }
  }
  return null;
}

function parseParsedInstruction(instruction: any, accountKeys: any[]): ObservedTransfer | null {
  const programId = instruction?.programId ?? null;
  const parsed = instruction?.parsed;
  if (!parsed || typeof parsed !== 'object') return null;

  if (programId === SYSTEM_PROGRAM && parsed.type === 'transfer') {
    const info = parsed.info;
    const amount = toAtomic(info?.lamports, 9);
    if (!info?.destination || !amount) return null;
    return {
      role: 'other',
      source: typeof info.source === 'string' ? info.source : null,
      destination: info.destination,
      asset: 'SOL',
      tokenMint: null,
      amountAtomic: amount,
      instructionIndex: null,
    };
  }

  if (programId === TOKEN_PROGRAM && (parsed.type === 'transfer' || parsed.type === 'transferChecked')) {
    const info = parsed.info;
    const amount = parsed.type === 'transferChecked'
      ? toAtomic(info?.tokenAmount?.amount, Number(info?.tokenAmount?.decimals ?? 0))
      : null;
    const fallbackAmount = parsed.type === 'transfer' && typeof info?.amount === 'string' && /^\d+$/.test(info.amount) ? info.amount : null;
    if (!info?.destination || !(amount || fallbackAmount) || !info?.mint) return null;
    return {
      role: 'other',
      source: typeof info.source === 'string' ? info.source : null,
      destination: info.destination,
      asset: 'USDC',
      tokenMint: info.mint,
      amountAtomic: amount || fallbackAmount!,
      instructionIndex: null,
    };
  }
  return null;
}

function collectInstructions(transaction: any): any[] {
  const message = transaction?.transaction?.message;
  const meta = transaction?.meta;
  const outer = Array.isArray(message?.instructions) ? message.instructions : [];
  const inner = Array.isArray(meta?.innerInstructions) ? meta.innerInstructions.flatMap((group: any) => Array.isArray(group.instructions) ? group.instructions : []) : [];
  return [...outer, ...inner];
}

function referenceInTransaction(transaction: any, reference: string): boolean {
  const keys = transaction?.transaction?.message?.accountKeys || [];
  return keys.some((key: any) => (typeof key === 'string' ? key : key?.pubkey) === reference);
}

function commitmentFor(observed: SolanaCommitment): SolanaCommitment {
  return observed;
}

export class SolanaRpcProvider implements SolanaPaymentProvider {
  constructor(private readonly rpcUrl: string, private readonly expectedAssetMints: Partial<Record<'USDC' | 'USDT', string>>) {}

  async getTransaction(signature: string, commitment: SolanaCommitment): Promise<ObservedPaymentTransaction | null> {
    const result = await rpc<any>(this.rpcUrl, 'getTransaction', [signature, {
      commitment: commitmentValue(commitment),
      encoding: 'jsonParsed',
      maxSupportedTransactionVersion: 0,
    }]);
    if (!result) return null;

    const transfers = collectInstructions(result)
      .map((instruction) => parseParsedInstruction(instruction, result?.transaction?.message?.accountKeys || []))
      .filter((transfer): transfer is ObservedTransfer => Boolean(transfer));

    const normalized = transfers.map((transfer) => {
      if (transfer.asset !== 'USDC') return transfer;
      const mint = transfer.tokenMint;
      const isUsdc = mint && this.expectedAssetMints.USDC === mint;
      const isUsdt = mint && this.expectedAssetMints.USDT === mint;
      return { ...transfer, asset: isUsdt ? 'USDT' : isUsdc ? 'USDC' : transfer.asset };
    });

    return {
      signature,
      success: result.meta?.err == null,
      commitment: commitmentFor(commitment),
      feePayer: result.transaction?.message?.accountKeys?.[0]?.pubkey ?? null,
      referenceMatched: false,
      transfers: normalized,
    };
  }

  async findTransactionsByReference(reference: string, commitment: SolanaCommitment): Promise<readonly ObservedPaymentTransaction[]> {
    const signatures = await rpc<any[]>(this.rpcUrl, 'getSignaturesForAddress', [reference, { commitment: commitmentValue(commitment), limit: 20 }]);
    const results: ObservedPaymentTransaction[] = [];
    for (const item of signatures) {
      if (!item?.signature || item?.err) continue;
      const transaction = await this.getTransaction(item.signature, commitment);
      if (transaction) results.push({ ...transaction, referenceMatched: referenceInTransaction(transaction, reference) });
    }
    return results;
  }

  async getHealth(): Promise<{ ok: boolean; slot: number | null; provider: string }> {
    try {
      const result = await rpc<number>(this.rpcUrl, 'getSlot', [{ commitment: 'finalized' }]);
      return { ok: true, slot: result, provider: 'solana-rpc' };
    } catch {
      return { ok: false, slot: null, provider: 'solana-rpc' };
    }
  }
}

export function createSolanaRpcProvider(env: RpcEnv, expectedAssetMints: Partial<Record<'USDC' | 'USDT', string>> = {}): SolanaRpcProvider {
  const rpcUrl = env.SOLANA_RPC_URL?.trim();
  if (!rpcUrl || !/^https:\/\//i.test(rpcUrl)) throw new Error('A valid HTTPS SOLANA_RPC_URL is required.');
  return new SolanaRpcProvider(rpcUrl, expectedAssetMints);
}
