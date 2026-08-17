type Env = {
  SOLANA_RPC_URL?: string;
  SOLANAFM_API_KEY?: string;
  HELIUS_API_KEY?: string;
};

type RpcResponse = { result?: unknown; error?: { code?: number; message?: string } };

type RpcSnapshot = {
  balanceLamports: number;
  tokenAccounts: any[];
  nonZeroTokens: any[];
  signatures: any[];
  partial: boolean;
  rpcErrors: string[];
};

const RPC_ENDPOINTS = [
  'https://api.mainnet.solana.com',
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
];
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112';
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1Kst4P3e9nKkM3u';
const MAX_TXS = 12;
const MAX_RPC_SIGNATURES = 20;
const CACHE_SECONDS = 30;

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=120`,
  'CDN-Cache-Control': `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=120`,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Access-Control-Allow-Origin': 'https://solmint.ir',
  'Vary': 'Origin',
};

function response(body: unknown, status = 200, cacheControl = jsonHeaders['Cache-Control']) {
  return new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, 'Cache-Control': cacheControl } });
}

function badRequest(code: string, message: string) {
  return response({ success: false, error: { code, message } }, 400, 'no-store');
}

function serverError(code: string, message: string, status = 502) {
  return response({ success: false, error: { code, message } }, status, 'no-store');
}

function validAddress(value: string) {
  return SOLANA_ADDRESS.test(value.trim());
}

function numeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 9000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(init.headers || {}) },
    });
    const text = await res.text();
    let payload: unknown = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function rpcEndpoints(env: Env) {
  const configured = env.SOLANA_RPC_URL?.trim();
  return configured ? [configured, ...RPC_ENDPOINTS.filter(x => x !== configured)] : RPC_ENDPOINTS;
}

async function rpcCall(env: Env, method: string, params: unknown[]): Promise<unknown> {
  let lastError = 'RPC request failed';
  for (const endpoint of rpcEndpoints(env)) {
    try {
      const data = await fetchJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      }, 8500) as RpcResponse;
      if (data?.error) throw new Error(data.error.message || `RPC ${data.error.code || 'error'}`);
      return data?.result;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'RPC request failed';
    }
  }
  throw new Error(`${method}: ${lastError}`);
}

function tokenRows(value: unknown) {
  const rows = value && typeof value === 'object' ? (value as { value?: unknown }).value : null;
  return Array.isArray(rows) ? rows : [];
}

function mapTokenAccounts(rows: any[], program: string) {
  return rows.map((row: any) => {
    const info = row?.account?.data?.parsed?.info;
    const amount = info?.tokenAmount;
    return {
      address: typeof row?.pubkey === 'string' ? row.pubkey : null,
      mint: typeof info?.mint === 'string' ? info.mint : null,
      owner: typeof info?.owner === 'string' ? info.owner : null,
      amount: amount?.amount ?? null,
      decimals: numeric(amount?.decimals),
      uiAmount: numeric(amount?.uiAmount),
      uiAmountString: typeof amount?.uiAmountString === 'string' ? amount.uiAmountString : null,
      program,
      state: typeof info?.state === 'string' ? info.state : null,
    };
  });
}

async function getRpcSnapshot(env: Env, address: string): Promise<RpcSnapshot> {
  const methods = [
    ['balance', 'getBalance', [address, { commitment: 'confirmed' }]],
    ['token', 'getTokenAccountsByOwner', [address, { programId: TOKEN_PROGRAM_ID }, { encoding: 'jsonParsed', commitment: 'confirmed' }]],
    ['token2022', 'getTokenAccountsByOwner', [address, { programId: TOKEN_2022_PROGRAM_ID }, { encoding: 'jsonParsed', commitment: 'confirmed' }]],
    ['signatures', 'getSignaturesForAddress', [address, { limit: MAX_RPC_SIGNATURES, commitment: 'confirmed' }]],
  ] as const;

  const results = await Promise.allSettled(methods.map(([, method, params]) => rpcCall(env, method, params)));
  const errors: string[] = [];
  const values: Record<string, unknown> = {};

  results.forEach((result, index) => {
    const key = methods[index][0];
    if (result.status === 'fulfilled') values[key] = result.value;
    else errors.push(`${key}: ${result.reason instanceof Error ? result.reason.message : 'request failed'}`);
  });

  if (!('balance' in values)) throw new Error(errors.join('; ') || 'Solana RPC unavailable');

  const legacy = mapTokenAccounts(tokenRows(values.token), 'spl-token');
  const token2022 = mapTokenAccounts(tokenRows(values.token2022), 'token-2022');
  const accounts = [...legacy, ...token2022];
  const nonZero = accounts.filter((token: any) => token.amount !== '0' && token.amount !== 0 && token.amount !== null && token.amount !== undefined);
  const signatures = Array.isArray(values.signatures) ? values.signatures : [];

  return {
    balanceLamports: numeric((values.balance as any)?.value) ?? 0,
    tokenAccounts: accounts,
    nonZeroTokens: nonZero,
    signatures,
    partial: errors.length > 0,
    rpcErrors: errors,
  };
}

function solfmHeaders(env: Env): HeadersInit {
  return env.SOLANAFM_API_KEY ? { Accept: 'application/json', ApiKey: env.SOLANAFM_API_KEY } : { Accept: 'application/json' };
}

async function getSolanaFmSnapshot(env: Env, address: string) {
  const base = 'https://api.solana.fm';
  const headers = solfmHeaders(env);
  const results = await Promise.allSettled([
    fetchJson(`${base}/v1/addresses/${encodeURIComponent(address)}/tokens`, { headers }, 10000),
    fetchJson(`${base}/v0/accounts/${encodeURIComponent(address)}/transfers?limit=50&page=1`, { headers }, 10000),
    fetchJson(`${base}/v0/accounts/${encodeURIComponent(address)}/transactions?limit=20&page=1`, { headers }, 10000),
  ]);
  return { tokens: results[0].status === 'fulfilled' ? results[0].value : null, transfers: results[1].status === 'fulfilled' ? results[1].value : null, transactions: results[2].status === 'fulfilled' ? results[2].value : null, available: results.some(x => x.status === 'fulfilled') };
}

async function getSolPriceUsd(): Promise<number | null> {
  try {
    const payload = await fetchJson(`https://api.dexscreener.com/token-pairs/v1/solana/${WRAPPED_SOL_MINT}`, {}, 6500);
    const pairs = Array.isArray(payload) ? payload : [];
    const ranked = pairs.map((p: any) => ({ priceUsd: numeric(p?.priceUsd), liquidity: numeric(p?.liquidity?.usd) ?? 0 })).filter((p: any) => p.priceUsd !== null).sort((a: any, b: any) => b.liquidity - a.liquidity);
    return ranked[0]?.priceUsd ?? null;
  } catch { return null; }
}

function normalizeTransfers(payload: any) {
  const raw = payload?.result;
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).map((item: any) => ({ transactionHash: item?.transactionHash ?? null, action: item?.action ?? null, status: item?.status ?? null, source: item?.source ?? null, destination: item?.destination ?? null, token: item?.token ?? null, amount: numeric(item?.amount), timestamp: numeric(item?.timestamp) }));
}

function normalizeTransactions(payload: any) {
  const raw = payload?.result;
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((item: any) => ({ signature: item?.signature ?? item?.transactionHash ?? null, blockTime: numeric(item?.blockTime), status: item?.status ?? null, slot: numeric(item?.slot), fee: numeric(item?.fee), actions: Array.isArray(item?.actions) ? item.actions.slice(0, 12) : [] }));
}

function normalizeTokens(payload: any) {
  const raw = payload?.result?.tokens || payload?.result?.tokenAccounts || payload?.tokens || [];
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 250).map((item: any) => {
    const info = item?.info || item?.data || item;
    const amount = info?.tokenAmount || info?.token?.amount || null;
    return { account: item?._id ?? item?.address ?? null, mint: info?.mint ?? null, amount: amount?.amount ?? null, decimals: numeric(amount?.decimals ?? info?.decimals), uiAmount: numeric(amount?.uiAmount), uiAmountString: typeof amount?.uiAmountString === 'string' ? amount.uiAmountString : null, type: item?.tokenType ?? info?.tokenType ?? null };
  });
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const address = (new URL(context.request.url).searchParams.get('address') || '').trim();
  if (!address) return badRequest('MISSING_ADDRESS', 'آدرس عمومی کیف پول ارسال نشده است.');
  if (!validAddress(address)) return badRequest('INVALID_ADDRESS', 'آدرس کیف پول از نظر قالب Base58 معتبر نیست.');

  try {
    const [rpcResult, fmResult, solPriceUsd] = await Promise.all([
      getRpcSnapshot(context.env, address),
      getSolanaFmSnapshot(context.env, address),
      getSolPriceUsd(),
    ]);

    const fmTokens = normalizeTokens(fmResult.tokens);
    const tokens = fmTokens.length ? fmTokens : rpcResult.nonZeroTokens;
    const transfers = normalizeTransfers(fmResult.transfers);
    const fmTransactions = normalizeTransactions(fmResult.transactions);
    const rpcTransactions = rpcResult.signatures.slice(0, MAX_TXS).map((item: any) => ({ signature: item?.signature ?? null, slot: numeric(item?.slot), blockTime: numeric(item?.blockTime), status: item?.err ? 'failed' : 'success', fee: null, actions: [] }));
    const transactions = fmTransactions.length ? fmTransactions : rpcTransactions;
    const successful = rpcResult.signatures.filter((item: any) => !item?.err);
    const balanceSol = rpcResult.balanceLamports / 1_000_000_000;

    return response({
      success: true,
      version: 'v2',
      source: { rpc: context.env.SOLANA_RPC_URL ? 'configured-rpc-with-fallbacks' : 'solana-public-rpc-with-fallbacks', enriched: fmResult.available ? 'solanafm-free' : 'rpc-only', market: solPriceUsd === null ? null : 'dexscreener-public' },
      wallet: { address, network: 'solana-mainnet', mode: 'read-only' },
      observedAt: new Date().toISOString(),
      balance: { lamports: rpcResult.balanceLamports, sol: balanceSol, priceUsd: solPriceUsd, valueUsd: solPriceUsd === null ? null : balanceSol * solPriceUsd },
      assets: { tokenAccountCount: rpcResult.tokenAccounts.length, nonZeroTokenCount: rpcResult.nonZeroTokens.length, tokens, nftCount: tokens.filter((t: any) => t.type === 'NonFungible' || t.type === 'CompressedNonFungible').length },
      activity: { transactionCountSampled: transactions.length, successfulTransactionCountSampled: successful.length, transferCount: transfers.length, firstActivity: successful[successful.length - 1]?.blockTime ?? null, lastActivity: successful[0]?.blockTime ?? null, transactions: transactions.slice(0, MAX_TXS), transfers: transfers.slice(0, 30) },
      analysis: { pnl: null, tradingStats: null, riskScore: null, note: 'PnL و امتیاز ریسک بدون داده تاریخی کافی محاسبه نمی‌شوند.' },
      capabilities: { rpcBalance: true, rpcTokenAccounts: rpcResult.tokenAccounts.length > 0 || !rpcResult.rpcErrors.some(x => x.startsWith('token:') || x.startsWith('token2022:')), rpcTransactionSignatures: rpcResult.signatures.length > 0 || !rpcResult.rpcErrors.some(x => x.startsWith('signatures:')), solanaFmEnrichment: fmResult.available, solPrice: solPriceUsd !== null, pnl: false, riskScoring: false },
      diagnostics: { partialRpc: rpcResult.partial, rpcErrors: rpcResult.rpcErrors },
      caveats: ['این گزارش فقط از داده عمومی بلاکچین استفاده می‌کند.', 'آدرس عمومی به‌تنهایی هویت مالک کیف پول را اثبات نمی‌کند.', 'PnL و ریسک تا زمان وجود داده تاریخی کافی ساخته نمی‌شوند.'],
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    return serverError('WALLET_ANALYSIS_UNAVAILABLE', `دریافت داده آن‌چین کیف پول ممکن نشد. ${reason}`, 503);
  }
}