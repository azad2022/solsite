import type { ObservedPaymentTransaction, ObservedTransfer, SolanaCommitment } from './verificationPolicy';
import type { SolanaPaymentProvider } from './blockchainProvider';
import type { TokenProgram } from '../types/domain';

const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const TOKEN_PROGRAM_ADDRESS = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ADDRESS = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxEb';
const RPC_TIMEOUT_MS = 8_000;
const MAX_DISCOVERY_PAGES = 24;
const DISCOVERY_PAGE_SIZE = 1_000;
const OUTER_INSTRUCTION_INDEX_BASE = 1_000_000;
const INNER_INSTRUCTION_INDEX_BASE = 10_000;

type RpcEnv = { SOLANA_RPC_URL?: string };
type RpcResponse<T> = { result?: T; error?: { code?: number; message?: string } };
type RpcAccountKey = string | { pubkey?: unknown };
type ParsedInstruction = {
  programId?: unknown;
  parsed?: unknown;
};
type ParsedTransaction = {
  transaction?: {
    message?: {
      accountKeys?: unknown;
      instructions?: unknown;
    };
  };
  meta?: {
    innerInstructions?: unknown;
    err?: unknown;
    fee?: unknown;
  };
  blockTime?: unknown;
  slot?: unknown;
};
type ParsedTransferInfo = {
  source?: unknown;
  destination?: unknown;
  authority?: unknown;
  lamports?: unknown;
  mint?: unknown;
  tokenAmount?: { amount?: unknown; decimals?: unknown };
};
type TokenAccountValue = {
  owner?: unknown;
  data?: { parsed?: { type?: unknown; info?: { mint?: unknown; owner?: unknown } } };
};
type TokenAccountResult = { value?: TokenAccountValue | null };
type SignatureEntry = { signature?: unknown; blockTime?: unknown };
type InstructionWithPath = { instruction: ParsedInstruction; instructionIndex: number };

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

function tokenProgramFromOwner(owner: unknown): TokenProgram | null {
  if (owner === TOKEN_PROGRAM_ADDRESS) return 'spl-token';
  if (owner === TOKEN_2022_PROGRAM_ADDRESS) return 'token-2022';
  return null;
}

function normalizeAccountKey(accountKey: unknown): string | null {
  if (typeof accountKey === 'string') return accountKey;
  if (!accountKey || typeof accountKey !== 'object') return null;
  const pubkey = (accountKey as RpcAccountKey & object).pubkey;
  return typeof pubkey === 'string' ? pubkey : null;
}

export function transactionContainsReference(transaction: unknown, reference: string): boolean {
  if (!reference || !transaction || typeof transaction !== 'object') return false;
  const tx = transaction as ParsedTransaction;
  const accountKeys = tx.transaction?.message?.accountKeys;
  if (!Array.isArray(accountKeys)) return false;
  return accountKeys.some((key) => normalizeAccountKey(key) === reference);
}

async function getTokenAccountInfo(url: string, address: string, commitment: SolanaCommitment): Promise<TokenAccountInfo> {
  const result = await rpc<TokenAccountResult>(url, 'getAccountInfo', [address, { encoding: 'jsonParsed', commitment: commitmentValue(commitment) }]);
  const value = result.value;
  if (!value) return { exists: false, program: null, mint: null, owner: null, accountType: null };
  const program = tokenProgramFromOwner(value.owner);
  if (!program) return { exists: true, program: null, mint: null, owner: null, accountType: null };
  const parsed = value.data?.parsed;
  const accountType = typeof parsed?.type === 'string' ? parsed.type : null;
  if (accountType !== 'account') return { exists: true, program, mint: null, owner: null, accountType };
  return {
    exists: true,
    program,
    mint: typeof parsed.info?.mint === 'string' ? parsed.info.mint : null,
    owner: typeof parsed.info?.owner === 'string' ? parsed.info.owner : null,
    accountType,
  };
}

type TokenAccountInfo = { exists: boolean; program: TokenProgram | null; mint: string | null; owner: string | null; accountType: string | null };

async function enrichTransfer(url: string, commitment: SolanaCommitment, transfer: ObservedTransfer): Promise<ObservedTransfer | null> {
  if (transfer.asset === 'SOL') return { ...transfer, sourceAuthority: transfer.source, destinationAuthority: transfer.destination };
  if (!transfer.source || !transfer.destination) return null;
  const [sourceInfo, destinationInfo] = await Promise.all([
    getTokenAccountInfo(url, transfer.source, commitment),
    getTokenAccountInfo(url, transfer.destination, commitment),
  ]);
  if (!sourceInfo.exists || !destinationInfo.exists) return null;
  if (!sourceInfo.program || sourceInfo.program !== destinationInfo.program) return null;
  if (!sourceInfo.mint || sourceInfo.mint !== destinationInfo.mint) return null;
  if (!destinationInfo.owner || !sourceInfo.owner) return null;
  return {
    ...transfer,
    tokenProgram: sourceInfo.program,
    sourceAuthority: transfer.sourceAuthority || sourceInfo.owner,
    destinationAuthority: destinationInfo.owner,
  };
}

function parseSupportedInstruction(instruction: ParsedInstruction, expectedAssetMints: Partial<Record<'USDC' | 'USDT', string>>, instructionIndex: number): ObservedTransfer | null {
  const programId = typeof instruction.programId === 'string' ? instruction.programId : null;
  const parsed = instruction.parsed;
  if (!parsed || typeof parsed !== 'object') return null;
  const parsedObject = parsed as { type?: unknown; info?: ParsedTransferInfo };

  if (programId === SYSTEM_PROGRAM && parsedObject.type === 'transfer') {
    const info = parsedObject.info;
    const amount = typeof info?.lamports === 'number' || typeof info?.lamports === 'string' ? String(info.lamports) : null;
    if (typeof info?.source !== 'string' || typeof info.destination !== 'string' || !amount || !/^\d+$/.test(amount)) return null;
    return { role: 'other', source: info.source, sourceAuthority: info.source, destination: info.destination, destinationAuthority: info.destination, asset: 'SOL', tokenMint: null, tokenProgram: null, tokenDecimals: null, amountAtomic: amount, instructionIndex };
  }

  if (programId !== TOKEN_PROGRAM_ADDRESS && programId !== TOKEN_2022_PROGRAM_ADDRESS) return null;
  if (parsedObject.type !== 'transferChecked') return null;
  const info = parsedObject.info;
  const mint = typeof info?.mint === 'string' ? info.mint : null;
  const decimals = Number(info?.tokenAmount?.decimals);
  const amount = typeof info?.tokenAmount?.amount === 'string' && /^\d+$/.test(info.tokenAmount.amount) ? info.tokenAmount.amount : null;
  if (typeof info?.source !== 'string' || typeof info.destination !== 'string' || !mint || !amount || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) return null;
  const asset = expectedAssetMints.USDC === mint ? 'USDC' : expectedAssetMints.USDT === mint ? 'USDT' : null;
  if (!asset) return null;
  return {
    role: 'other',
    source: info.source,
    sourceAuthority: typeof info.authority === 'string' ? info.authority : null,
    destination: info.destination,
    destinationAuthority: null,
    asset,
    tokenMint: mint,
    tokenProgram: programId === TOKEN_2022_PROGRAM_ADDRESS ? 'token-2022' : 'spl-token',
    tokenDecimals: decimals,
    amountAtomic: amount,
    instructionIndex,
  };
}

function outerInstructionIndex(index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= INNER_INSTRUCTION_INDEX_BASE) throw new Error('Invalid outer instruction index.');
  return OUTER_INSTRUCTION_INDEX_BASE + index;
}

function innerInstructionIndex(parentIndex: number, childIndex: number): number {
  if (!Number.isInteger(parentIndex) || parentIndex < 0 || parentIndex >= INNER_INSTRUCTION_INDEX_BASE) throw new Error('Invalid inner parent instruction index.');
  if (!Number.isInteger(childIndex) || childIndex < 0 || childIndex >= INNER_INSTRUCTION_INDEX_INDEX_BASE) throw new Error('Invalid inner child instruction index.');
  return -((parentIndex * INNER_INSTRUCTION_INDEX_BASE) + childIndex + 1);
}

function collectParsedInstructions(transaction: unknown): InstructionWithPath[] {
  if (!transaction || typeof transaction !== 'object') return [];
  const tx = transaction as ParsedTransaction;
  const outer = Array.isArray(tx.transaction?.message?.instructions) ? tx.transaction.message.instructions : [];
  const entries: InstructionWithPath[] = [];

  outer.forEach((instruction, index) => {
    if (instruction && typeof instruction === 'object') {
      entries.push({ instruction: instruction as ParsedInstruction, instructionIndex: outerInstructionIndex(index) });
    }
  });

  const innerGroups = Array.isArray(tx.meta?.innerInstructions) ? tx.meta.innerInstructions : [];
  for (const group of innerGroups) {
    if (!group || typeof group !== 'object') continue;
    const parentIndex = (group as { index?: unknown }).index;
    if (typeof parentIndex !== 'number' || !Number.isInteger(parentIndex) || parentIndex < 0) continue;
    const instructions = (group as { instructions?: unknown }).instructions;
    if (!Array.isArray(instructions)) continue;
    instructions.forEach((instruction, childIndex) => {
      if (instruction && typeof instruction === 'object') {
        entries.push({ instruction: instruction as ParsedInstruction, instructionIndex: innerInstructionIndex(parentIndex, childIndex) });
      }
    });
  }

  return entries;
}

export class SolanaRpcProvider implements SolanaPaymentProvider {
  constructor(private readonly rpcUrl: string, private readonly expectedAssetMints: Partial<Record<'USDC' | 'USDT', string>>) {}

  private async fetchTransaction(signature: string, commitment: SolanaCommitment): Promise<ParsedTransaction | null> {
    return await rpc<ParsedTransaction | null>(this.rpcUrl, 'getTransaction', [signature, { commitment: commitmentValue(commitment), encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]);
  }

  private async normalize(result: ParsedTransaction, signature: string, commitment: SolanaCommitment): Promise<ObservedPaymentTransaction> {
    const parsedTransfers = collectParsedInstructions(result)
      .map(({ instruction, instructionIndex }) => parseSupportedInstruction(instruction, this.expectedAssetMints, instructionIndex))
      .filter((transfer): transfer is ObservedTransfer => Boolean(transfer));
    const transfers: ObservedTransfer[] = [];
    for (const transfer of parsedTransfers) {
      const enriched = await enrichTransfer(this.rpcUrl, commitment, transfer);
      if (enriched) transfers.push(enriched);
    }
    const blockTime = typeof result.blockTime === 'number' ? new Date(result.blockTime * 1000).toISOString() : null;
    const slot = typeof result.slot === 'number' ? result.slot : null;
    const networkFeeLamports = typeof result.meta?.fee === 'number' || typeof result.meta?.fee === 'string' ? String(result.meta.fee) : null;
    const feePayerKeys = result.transaction?.message?.accountKeys;
    const feePayer = Array.isArray(feePayerKeys) ? normalizeAccountKey(feePayerKeys[0]) : null;
    return { signature, slot, blockTime, networkFeeLamports, success: result.meta?.err == null, commitment, feePayer, referenceMatched: false, transfers };
  }

  async getTransaction(signature: string, commitment: SolanaCommitment): Promise<ObservedPaymentTransaction | null> {
    const result = await this.fetchTransaction(signature, commitment);
    if (!result) return null;
    return this.normalize(result, signature, commitment);
  }

  async findTransactionsByReference(reference: string, commitment: SolanaCommitment, window?: { createdAt: string; expiresAt: string }): Promise<readonly ObservedPaymentTransaction[]> {
    if (!reference) return [];
    const windowStart = window ? Date.parse(window.createdAt) : Number.NEGATIVE_INFINITY;
    const windowEnd = window ? Date.parse(window.expiresAt) : Number.POSITIVE_INFINITY;
    if (window && (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd < windowStart)) throw new Error('Invalid payment discovery window.');

    const results: ObservedPaymentTransaction[] = [];
    let before: string | undefined;

    for (let page = 0; page < MAX_DISCOVERY_PAGES; page += 1) {
      const options: Record<string, unknown> = { commitment: commitmentValue(commitment), limit: DISCOVERY_PAGE_SIZE };
      if (before) options.before = before;
      const signatures = await rpc<SignatureEntry[]>(this.rpcUrl, 'getSignaturesForAddress', [reference, options]);
      if (!Array.isArray(signatures) || signatures.length === 0) return results;

      let reachedStart = false;
      for (const item of signatures) {
        const signature = typeof item.signature === 'string' ? item.signature : null;
        if (!signature) continue;
        const timestamp = typeof item.blockTime === 'number' ? item.blockTime * 1000 : null;
        if (timestamp !== null && timestamp < windowStart) {
          reachedStart = true;
          break;
        }
        if (timestamp !== null && timestamp > windowEnd) continue;
        const raw = await this.fetchTransaction(signature, commitment);
        if (!raw) continue;
        const observation = await this.normalize(raw, signature, commitment);
        if (transactionContainsReference(raw, reference)) results.push({ ...observation, referenceMatched: true });
      }

      if (reachedStart || signatures.length < DISCOVERY_PAGE_SIZE) return results;
      before = typeof signatures[signatures.length - 1]?.signature === 'string' ? signatures[signatures.length - 1].signature : undefined;
      if (!before) return results;
    }

    throw new Error('REFERENCE_DISCOVERY_INCOMPLETE');
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
