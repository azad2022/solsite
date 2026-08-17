type Env = {
  SOLANA_RPC_URL?: string;
  SOLANAFM_API_KEY?: string;
  HELIUS_API_KEY?: string;
};

type RpcResponse = { result?: unknown; error?: { code?: number; message?: string } };

const DEFAULT_RPC = 'https://api.mainnet.solana.com';
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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, 'Cache-Control': cacheControl },
  });
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
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function rpcUrl(env: Env) {
  return (env.SOLANA_RPC_URL || DEFAULT_RPC).trim() || DEFAULT_RPC;
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 9000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    let payload: unknown = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
    if (!res.ok) {
      const error = new Error(`Upstream HTTP ${res.status}`);
      (error as Error & { status?: number; payload?: unknown }).status = res.status;
      (error as Error & { status?: number; payload?: unknown }).payload = payload;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function rpcCall(env: Env, method: string, params: unknown[]): Promise<unknown> {
  const payload = { jsonrpc: '2.0', id: crypto.randomUUID(), method, params };
  const data = await fetchJson(rpcUrl(env), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const rpc = (data || {}) as RpcResponse;
  if (rpc.error) throw new Error(rpc.error.message || `RPC ${rpc.error.code || 'error'}`);
  return rpc.result;
}

function solanaTokenRows(value: unknown) {
  if (!value || typeof value !== 'object') return [];
  const rows = (value as { value?: unknown }).value;
  return Array.isArray(rows) ? rows : [];
}

async function getRpcSnapshot(env: Env, address: string) {
  const [balance, legacyTokens, token2022, signatures] = await Promise.all([
    rpcCall(env, 'getBalance', [address, { commitment: 'confirmed' }]),
    rpcCall(env, 'getTokenAccountsByOwner', [address, { programId: TOKEN_PROGRAM_ID }, { encoding: 'jsonParsed', commitment: 'confirmed' }]),
    rpcCall(env, 'getTokenAccountsByOwner', [address, { programId: TOKEN_2022_PROGRAM_ID }, { encoding: 'jsonParsed', commitment: 'confirmed' }]),
    rpcCall(env, 'getSignaturesForAddress', [address, { limit: MAX_RPC_SIGNATURES, commitment: 'confirmed' }]),
  ]);

  const legacyRows = solanaTokenRows(legacyTokens);
  const token2022Rows = solanaTokenRows(token2022);
  const tokenAccounts = [...legacyRows, ...token2022Rows].map((row: any) => {
    const info = row?.account?.data?.parsed?.info;
    const tokenAmount = info?.tokenAmount;
    return {
      address: typeof row?.pubkey === 'string' ? row.pubkey : null,
      mint: typeof info?.mint === 'string' ? info.mint : null,
      owner: typeof info?.owner === 'string' ? info.owner : null,
      amount: tokenAmount?.amount ?? null,
      decimals: numeric(tokenAmount?.decimals),
      uiAmount: numeric(tokenAmount?.uiAmount),
      uiAmountString: typeof tokenAmount?.uiAmountString === 'string' ? tokenAmount.uiAmountString : null,
      program: token2022Rows.includes(row) ? 'token-2022' : 'spl-token',
      state: typeof info?.state === 'string' ? info.state : null,
    };
  });

  const nonZeroTokens = tokenAccounts.filter((token: any) => (token.amount && token.amount !== '0') || (token.uiAmount && token.uiAmount !== 0));
  const signatureRows = Array.isArray(signatures) ? signatures : [];

  return {
    balanceLamports: numeric((balance as any)?.value) ?? 0,
    tokenAccounts,
    nonZeroTokens,
    signatures: signatureRows,
  };
}

function solfmHeaders(env: Env): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (env.SOLANAFM_API_KEY) headers['ApiKey'] = env.SOLANAFM_API_KEY;
  return headers;
}

async function getSolanaFmSnapshot(env: Env, address: string) {
  const base = 'https://api.solana.fm';
  const headers = solfmHeaders(env);
  const [tokensRes, transfersRes, transactionsRes] = await Promise.allSettled([
    fetchJson(`${base}/v1/addresses/${encodeURIComponent(address)}/tokens`, { headers }, 10000),
    fetchJson(`${base}/v0/accounts/${encodeURIComponent(address)}/transfers?limit=50&page=1`, { headers }, 10000),
    fetchJson(`${base}/v0/accounts/${encodeURIComponent(address)}/transactions?limit=20&page=1`, { headers }, 10000),
  ]);

  const unwrap = (item: PromiseSettledResult<unknown>) => item.status === 'fulfilled' ? item.value : null;
  return {
    tokens: unwrap(tokensRes),
    transfers: unwrap(transfersRes),
    transactions: unwrap(transactionsRes),
    available: Boolean(unwrap(tokensRes) || unwrap(transfersRes) || unwrap(transactionsRes)),
  };
}

async function getSolPriceUsd(env: Env): Promise<number | null> {
  try {
    const payload = await fetchJson(`https://api.dexscreener.com/token-pairs/v1/solana/${WRAPPED_SOL_MINT}`, {}, 6500);
    const pairs = Array.isArray(payload) ? payload : [];
    const ranked = pairs
      .map((pair: any) => ({ priceUsd: numeric(pair?.priceUsd), liquidity: numeric(pair?.liquidity?.usd) ?? 0 }))
      .filter((pair: any) => pair.priceUsd !== null)
      .sort((a: any, b: any) => b.liquidity - a.liquidity);
    return ranked[0]?.priceUsd ?? null;
  } catch {
    return null;
  }
}

function normalizeTransfers(payload: any) {
  const raw = payload?.result;
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).map((item: any) => ({
    transactionHash: typeof item?.transactionHash === 'string' ? item.transactionHash : null,
    action: typeof item?.action === 'string' ? item.action : null,
    status: typeof item?.status === 'string' ? item.status : null,
    source: typeof item?.source === 'string' ? item.source : null,
    destination: typeof item?.destination === 'string' ? item.destination : null,
    token: typeof item?.token === 'string' ? item.token : null,
    amount: numeric(item?.amount),
    timestamp: numeric(item?.timestamp),
  }));
}

function normalizeTransactions(payload: any) {
  const raw = payload?.result;
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((item: any) => ({
    signature: typeof item?.signature === 'string' ? item.signature : typeof item?.transactionHash === 'string' ? item.transactionHash : null,
    blockTime: numeric(item?.blockTime),
    status: typeof item?.status === 'string' ? item.status : null,
    slot: numeric(item?.slot),
    fee: numeric(item?.fee),
    actions: Array.isArray(item?.actions) ? item.actions.slice(0, 12) : [],
  }));
}

function normalizeTokens(payload: any) {
  const raw = payload?.result?.tokens || payload?.result?.tokenAccounts || payload?.tokens || [];
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 250).map((item: any) => {
    const info = item?.info || item?.data || item;
    const tokenAmount = info?.tokenAmount || info?.token?.amount || null;
    return {
      account: typeof item?._id === 'string' ? item._id : typeof item?.address === 'string' ? item.address : null,
      mint: typeof info?.mint === 'string' ? info.mint : null,
      amount: tokenAmount?.amount ?? null,
      decimals: numeric(tokenAmount?.decimals ?? info?.decimals),
      uiAmount: numeric(tokenAmount?.uiAmount),
      uiAmountString: typeof tokenAmount?.uiAmountString === 'string' ? tokenAmount.uiAmountString : null,
      type: typeof item?.tokenType === 'string' ? item.tokenType : typeof info?.tokenType === 'string' ? info.tokenType : null,
    };
  });
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const url = new URL(context.request.url);
  const address = (url.searchParams.get('address') || '').trim();

  if (!address) return badRequest('MISSING_ADDRESS', 'آدرس عمومی کیف پول ارسال نشده است.');
  if (!validAddress(address)) return badRequest('INVALID_ADDRESS', 'آدرس کیف پول از نظر قالب Base58 معتبر نیست.');

  try {
    const [rpcResult, fmResult, solPriceUsd] = await Promise.all([
      getRpcSnapshot(context.env, address),
      getSolanaFmSnapshot(context.env, address),
      getSolPriceUsd(context.env),
    ]);

    const fmTokens = normalizeTokens(fmResult.tokens);
    const rpcTokens = rpcResult.nonZeroTokens;
    const tokens = fmTokens.length ? fmTokens : rpcTokens;
    const transfers = normalizeTransfers(fmResult.transfers);
    const fmTransactions = normalizeTransactions(fmResult.transactions);
    const rpcTransactions = rpcResult.signatures.slice(0, MAX_TXS).map((item: any) => ({
      signature: typeof item?.signature === 'string' ? item.signature : null,
      slot: numeric(item?.slot),
      blockTime: numeric(item?.blockTime),
      status: item?.err ? 'failed' : 'success',
      fee: null,
      actions: [],
    }));
    const transactions = fmTransactions.length ? fmTransactions : rpcTransactions;
    const successfulSignatures = rpcResult.signatures.filter((item: any) => !item?.err);

    const balanceSol = rpcResult.balanceLamports / 1_000_000_000;
    const solValueUsd = solPriceUsd === null ? null : balanceSol * solPriceUsd;
    const firstActivity = successfulSignatures[successfulSignatures.length - 1]?.blockTime ?? null;
    const lastActivity = successfulSignatures[0]?.blockTime ?? null;

    return response({
      success: true,
      version: 'v1',
      source: {
        rpc: context.env.SOLANA_RPC_URL ? 'configured-rpc' : 'solana-public-rpc',
        enriched: fmResult.available ? 'solanafm-free' : 'rpc-only',
        market: solPriceUsd === null ? null : 'dexscreener-public',
      },
      wallet: {
        address,
        network: 'solana-mainnet',
        mode: 'read-only',
      },
      observedAt: new Date().toISOString(),
      balance: {
        lamports: rpcResult.balanceLamports,
        sol: balanceSol,
        priceUsd: solPriceUsd,
        valueUsd: solValueUsd,
      },
      assets: {
        tokenAccountCount: rpcResult.tokenAccounts.length,
        nonZeroTokenCount: rpcTokens.length,
        tokens,
        nftCount: tokens.filter((token: any) => token.type === 'NonFungible' || token.type === 'CompressedNonFungible').length,
      },
      activity: {
        transactionCountSampled: transactions.length,
        successfulTransactionCountSampled: successfulSignatures.length,
        transferCount: transfers.length,
        firstActivity,
        lastActivity,
        transactions: transactions.slice(0, MAX_TXS),
        transfers: transfers.slice(0, 30),
      },
      analysis: {
        pnl: null,
        tradingStats: null,
        riskScore: null,
        note: 'محاسبه PnL، سود و زیان و امتیاز ریسک تا زمانی که داده تاریخی و قیمت‌گذاری کافی در دسترس نباشد، عمداً انجام نمی‌شود.',
      },
      capabilities: {
        rpcBalance: true,
        rpcTokenAccounts: true,
        rpcTransactionSignatures: true,
        solanaFmEnrichment: fmResult.available,
        solPrice: solPriceUsd !== null,
        pnl: false,
        riskScoring: false,
      },
      caveats: [
        'این گزارش فقط از داده عمومی بلاکچین و منابع داده عمومی استفاده می‌کند.',
        'آدرس عمومی به‌تنهایی هویت واقعی مالک کیف پول را ثابت نمی‌کند.',
        'داده‌های PnL و ریسک بدون قیمت تاریخی و طبقه‌بندی کامل تراکنش‌ها قابل اتکا نیستند و در این نسخه ساخته نمی‌شوند.',
      ],
    });
  } catch (error) {
    console.error('Wallet analyzer failed:', error);
    const message = error instanceof Error ? error.message : '';
    if (/429|rate/i.test(message)) return serverError('UPSTREAM_RATE_LIMIT', 'منبع داده موقتاً به محدودیت درخواست رسیده است.', 503);
    return serverError('WALLET_ANALYSIS_UNAVAILABLE', 'دریافت داده کیف پول در حال حاضر امکان‌پذیر نیست.', 503);
  }
}
