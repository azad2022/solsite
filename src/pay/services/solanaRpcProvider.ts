import type { ObservedPaymentTransaction, ObservedTransfer, SolanaCommitment } from './verificationPolicy';
import type { SolanaPaymentProvider } from './blockchainProvider';
import type { TokenProgram } from '../types/domain';

const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const TOKEN_PROGRAM_ADDRESS = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ADDRESS = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxEb';
const RPC_TIMEOUT_MS = 8_000;

type TokenAccountInfo = {
  exists: boolean;
  program: TokenProgram | null;
  mint: string | null;
  owner: string | null;
  decimals: number | null;
  accountType: string | null;
};

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

function atomicFromTokenAmount(amount: unknown): string | null {
  if (typeof amount !== 'string' || !/^\d+$/.test(amount)) return null;
  return amount;
}

function tokenProgramFromOwner(owner: unknown): TokenProgram | null {
  if (owner === TOKEN_PROGRAM_ADDRESS) return 'spl-token';
  if (owner === TOKEN_2022_PROGRAM_ADDRESS) return 'token-2022';
  return null;
}

async function getTokenAccountInfo(url: string, address: string): Promise<TokenAccountInfo> {
  const result = await rpc<any>(url, 'getAccountInfo', [address, { encoding: 'jsonParsed', commitment: 'finalized' }]);
  const value = result?.value;
  if (!value) return { exists: false, program: null, mint: null, owner: null, decimals: null, accountType: null };

  const program = tokenProgramFromOwner(value.owner);
  if (!program) return { exists: true, program: null, mint: null, owner: null, decimals: null, accountType: null };

  const parsed = value.data?.parsed;
  const accountType = typeof parsed?.type === 'string' ? parsed.type : null;
  if (accountType !== 'account') return { exists: true, program, mint: null, owner: null, decimals: null, accountType };

  return {
    exists: true,
    program,
    mint: typeof parsed.info?.mint === 'string' ? parsed.info.mint : null,
    owner: typeof parsed.info?.owner === 'string' ? parsed.info.owner : null,
    decimals: null,
    accountType,
  };
}

async function enrichTransfer(
  url: string,
  transfer: ObservedTransfer,
): Promise<ObservedTransfer | null> {
  if (transfer.asset === 'SOL') {
    return { ...transfer, sourceAuthority: transfer.source };
  }
  if (!transfer.source || !transfer.destination) return null;

  const [sourceInfo, destinationInfo] = await Promise.all([
    getTokenAccountInfo(url, transfer.source),
    getTokenAccountInfo(url, transfer.destination),
  ]);

  if (!sourceInfo.exists || !destinationInfo.exists) return null;
  if (!sourceInfo.program || sourceInfo.program !== destinationInfo.program) return null;
  if (!sourceInfo.mint || sourceInfo.mint !== destinationInfo.mint) return null;
  if (!destinationInfo.owner || !sourceInfo.owner) return null;

  return {
    ...transfer,
    tokenProgram: sourceInfo.program,
    sourceAuthority: sourceInfo.owner,
    destinationAuthority: destinationInfo.owner,
  };
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
    const amount = typeof info?.lamports === 'number' || typeof info?.lamports === 'string'
      ? String(info.lamports)
      : null;
    if (!info?.source || !info?.destination || !amount || !/^\d+$/.test(amount)) return null;
    return {
      role: 'other', source: info.source, sourceAuthority: info.source,
      destination: info.destination, destinationAuthority: info.destination,
      asset: 'SOL', tokenMint: null, tokenProgram: null, tokenDecimals: 9,
      amountAtomic: amount, instructionIndex: null,
    };
  }

  if (programId !== TOKEN_PROGRAM_ADDRESS && programId !== TOKEN_2022_PROGRAM_ADDRESS) return null;
  if (parsed.type !== 'transferChecked') return null;

  const info = parsed.info;
  const mint = typeof info?.mint === 'string' ? info.mint : null;
  const decimals = Number(info?.tokenAmount?.decimals);
  const amount = atomicFromTokenAmount(info?.tokenAmount?.amount);
  if (!info?.source || !info?.destination || !mint || !amount || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) return null;

  const asset = expectedAssetMints.USDC === mint ? 'USDC' : expectedAssetMints.USDT === mint ? 'USDT' : null;
  if (!asset) return null;

  return {
    role: 'other', source: info.source, sourceAuthority: null,
    destination: info.destination, destinationAuthority: null,
    asset, tokenMint: mint,
    tokenProgram: programId === TOKEN_2022_PROGRAM_ADDRESS ? 'token-2022' : 'spl-token',
    tokenDecimals: decimals,
    amountAtomic: amount, instructionIndex: null,
  };
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

    const parsedTransfers = collectParsedInstructions(result)
      .map((instruction) => parseSupportedInstruction(instruction, this.expectedAssetMints))
      .filter((transfer): transfer is ObservedTransfer => Boolean(transfer));

    const transfers: ObservedTransfer[] = [];
    for (const transfer of parsedTransfers) {
      const enriched = await enrichTransfer(this.rpcUrl, transfer);
      if (enriched) transfers.push(enriched);
    }

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
