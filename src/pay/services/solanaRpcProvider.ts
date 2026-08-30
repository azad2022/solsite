import type { ObservedPaymentTransaction, ObservedTransfer, SolanaCommitment } from './verificationPolicy';
import type { SolanaPaymentProvider } from './blockchainProvider';

const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const RPC_TIMEOUT_MS = 8_000;

interface RpcEnv {
  SOLANA_RPC_URL?: string;
}

type RpcResponse<T> = { result?: T; error?: { code?: number; message?: string } };

function commitmentValue(value: SolanaCommitment): 'confirmed' | 'finalized' {
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

function toAtomicDecimal(value: unknown, decimals: number): string | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const normalized = String(value);
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  if (fraction.length > decimals) return null;
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals))).toString();
}

function parseSupportedInstruction(
  instruction: any,
  expectedAssetMints: Partial<Record<'USDC' | 'USDT', string>>,
): ObservedTransfer | null {
  const programId = instruction?.programId ?? null;
  const parsed = instruction?.parsed;
  if (!parsed || typeof parsed !== 'object') return null;

  if (programId === SYSTEM_PROGRAM && parsed.type === 'transfer') {
    const info = parsed.info;
    const amount = toAtomicDecimal(info?.lamports, 9);
    if (!info?.source || !info?.destination || !amount) return null;
    return { role: 'other', source: info.source, destination: info.destination, asset: 'SOL', tokenMint: null, amountAtomic: amount, instructionIndex: null };
  }

  // Only TransferChecked is accepted for SPL payment recognition here. Its
  // parsed tokenAmount carries both exact atomic amount and decimals, while the
  // mint is explicit. Plain Transfer would require an additional token-account
  // lookup before it can safely be recognized.
  if (programId !== TOKEN_PROGRAM || parsed.type !== 'transferChecked') return null;
  const info = parsed.info;
  const mint = typeof info?.mint === 'string' ? info.mint : null;
  const decimals = Number(info?.tokenAmount?.decimals);
  const amount = toAtomicDecimal(info?.tokenAmount?.uiAmountString ?? info?.tokenAmount?.uiAmount, Number.isInteger(decimals) ? decimals : -1);
  if (!info?.source || !info?.destination || !mint || !Number.isInteger(decimals) || decimals < 0 || !amount) return null;

  const asset = expectedAssetMints.USDC === mint ? 'USDC' : expectedAssetMints.USDT === mint ? 'USDT' : null;
  if (!asset) return null;

  return { role: 'other', source: info.source, destination: info.destination, asset, tokenMint: mint, amountAtomic: amount, instructionIndex: null };
}

function collectParsedInstructions(transaction: any): any[] {
  const message = transaction?.transaction?.message;
  const meta = transaction?.meta;
  const outer = Array.isArray(message?.instructions) ? message.instructions : [];
  const inner = Array.isArray(meta?.innerInstructions)
    ? meta.innerInstructions.flatMap((group: any) => Array.isArray(group.instructions) ? group.instructions : [])
    : [];
  return [...outer, ...inner];
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

    const transfers = collectParsedInstructions(result)
      .map((instruction) => parseSupportedInstruction(instruction, this.expectedAssetMints))
      .filter((transfer): transfer is ObservedTransfer => Boolean(transfer));

    return {
      signature,
      success: result.meta?.err == null,
      commitment,
      feePayer: result.transaction?.message?.accountKeys?.[0]?.pubkey ?? null,
      referenceMatched: false,
      transfers,
    };
  }

  async findTransactionsByReference(reference: string, commitment: SolanaCommitment): Promise<readonly ObservedPaymentTransaction[]> {
    const signatures = await rpc<any[]>(this.rpcUrl, 'getSignaturesForAddress', [reference, { commitment: commitmentValue(commitment), limit: 20 }]);
    const results: ObservedPaymentTransaction[] = [];
    for (const item of signatures) {
      if (!item?.signature || item?.err) continue;
      const transaction = await this.getTransaction(item.signature, commitment);
      // The candidate was discovered by getSignaturesForAddress(reference), so
      // the RPC itself established account-level reference correlation. A later
      // verifier still checks the concrete transfer legs and snapshot.
      if (transaction) results.push({ ...transaction, referenceMatched: true });
    }
    return results;
  }

  async getHealth(): Promise<{ ok: boolean; slot: number | null; provider: string }> {
    try {
      return { ok: true, slot: await rpc<number>(this.rpcUrl, 'getSlot', [{ commitment: 'finalized' }]), provider: 'solana-rpc' };
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
