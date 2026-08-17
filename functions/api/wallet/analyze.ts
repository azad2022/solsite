type Env = {
  SOLANA_RPC_URL?: string;
  SOLANAFM_API_KEY?: string;
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
const MAX_SECURITY_TOKENS = 20;
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

async function rpcCall(env: Env, method: string, params: readonly unknown[]): Promise<unknown> {
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
    fetchJson(`${base}/v0/accounts/${encodeURIComponent(address)}/transfers?limit=100&page=1`, { headers }, 10000),
    fetchJson(`${base}/v0/accounts/${encodeURIComponent(address)}/transactions?limit=100&page=1`, { headers }, 10000),
  ]);
  return {
    tokens: results[0].status === 'fulfilled' ? results[0].value : null,
    transfers: results[1].status === 'fulfilled' ? results[1].value : null,
    transactions: results[2].status === 'fulfilled' ? results[2].value : null,
    available: results.some(x => x.status === 'fulfilled'),
  };
}

async function getSolPriceUsd(): Promise<number | null> {
  try {
    const payload = await fetchJson(`https://api.dexscreener.com/token-pairs/v1/solana/${WRAPPED_SOL_MINT}`, {}, 6500);
    const pairs = Array.isArray(payload) ? payload : [];
    const ranked = pairs
      .map((p: any) => ({ priceUsd: numeric(p?.priceUsd), liquidity: numeric(p?.liquidity?.usd) ?? 0 }))
      .filter((p: any) => p.priceUsd !== null)
      .sort((a: any, b: any) => b.liquidity - a.liquidity);
    return ranked[0]?.priceUsd ?? null;
  } catch { return null; }
}

function normalizeTransfers(payload: any) {
  const raw = payload?.result;
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 100).map((item: any) => ({
    transactionHash: item?.transactionHash ?? null,
    action: item?.action ?? null,
    status: item?.status ?? null,
    source: item?.source ?? null,
    destination: item?.destination ?? null,
    token: item?.token ?? null,
    amount: numeric(item?.amount),
    timestamp: numeric(item?.timestamp),
  }));
}

function normalizeTransactions(payload: any) {
  const raw = payload?.result;
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 100).map((item: any) => ({
    signature: item?.signature ?? item?.transactionHash ?? null,
    blockTime: numeric(item?.blockTime),
    status: item?.status ?? null,
    slot: numeric(item?.slot),
    fee: numeric(item?.fee),
    actions: Array.isArray(item?.actions) ? item.actions.slice(0, 20) : [],
    programs: Array.isArray(item?.programs) ? item.programs.slice(0, 20) : [],
  }));
}

function normalizeTokens(payload: any) {
  const raw = payload?.result?.tokens || payload?.result?.tokenAccounts || payload?.tokens || [];
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 250).map((item: any) => {
    const info = item?.info || item?.data || item;
    const amount = info?.tokenAmount || info?.token?.amount || null;
    return {
      account: item?._id ?? item?.address ?? null,
      mint: info?.mint ?? null,
      amount: amount?.amount ?? null,
      decimals: numeric(amount?.decimals ?? info?.decimals),
      uiAmount: numeric(amount?.uiAmount),
      uiAmountString: typeof amount?.uiAmountString === 'string' ? amount.uiAmountString : null,
      type: item?.tokenType ?? info?.tokenType ?? null,
      symbol: item?.symbol ?? info?.symbol ?? null,
      name: item?.tokenName ?? info?.tokenName ?? item?.name ?? null,
      image: item?.image ?? info?.image ?? item?.logo ?? null,
    };
  });
}

function extractProtocolCandidates(transactions: any[]) {
  const names = new Map<string, number>();
  for (const tx of transactions) {
    const candidates: unknown[] = [
      ...(Array.isArray(tx?.programs) ? tx.programs : []),
      ...(Array.isArray(tx?.actions) ? tx.actions : []),
    ];
    for (const item of candidates) {
      if (typeof item === 'string') {
        const lower = item.toLowerCase();
        if (lower.includes('jupiter')) names.set('Jupiter', (names.get('Jupiter') || 0) + 1);
        else if (lower.includes('raydium')) names.set('Raydium', (names.get('Raydium') || 0) + 1);
        else if (lower.includes('orca') || lower.includes('whirlpool')) names.set('Orca', (names.get('Orca') || 0) + 1);
      } else if (item && typeof item === 'object') {
        const text = JSON.stringify(item).toLowerCase();
        if (text.includes('jupiter')) names.set('Jupiter', (names.get('Jupiter') || 0) + 1);
        if (text.includes('raydium')) names.set('Raydium', (names.get('Raydium') || 0) + 1);
        if (text.includes('orca') || text.includes('whirlpool')) names.set('Orca', (names.get('Orca') || 0) + 1);
      }
    }
  }
  return [...names.entries()].map(([name, interactions]) => ({ name, interactions })).sort((a, b) => b.interactions - a.interactions);
}

async function getTokenSecurity(env: Env, mints: string[]) {
  if (!mints.length) return [];
  const unique = [...new Set(mints.filter(Boolean))].slice(0, MAX_SECURITY_TOKENS);
  const base = 'https://api.solana.fm/v1/tokens';
  try {
    const payload = await fetchJson(base, {
      method: 'POST',
      headers: { ...solfmHeaders(env), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens: unique }),
    }, 10000) as any;
    const result = payload?.result && typeof payload.result === 'object' ? payload.result : payload && typeof payload === 'object' ? payload : {};
    return unique.map(mint => {
      const info = result?.[mint] || null;
      const flags: string[] = [];
      if (info?.mintAuthority) flags.push('mint-authority-active');
      if (info?.freezeAuthority) flags.push('freeze-authority-active');
      if (info?.tokenType === 'NonFungible' || info?.tokenType === 'CompressedNonFungible') flags.push('nft');
      return {
        mint,
        name: info?.tokenList?.name ?? null,
        symbol: info?.tokenList?.symbol ?? null,
        tokenType: info?.tokenType ?? null,
        mintAuthority: info?.mintAuthority ?? null,
        freezeAuthority: info?.freezeAuthority ?? null,
        riskFlags: flags,
      };
    });
  } catch {
    return [];
  }
}

function summarizeFlows(transfers: any[], wallet: string) {
  let incoming = 0;
  let outgoing = 0;
  let other = 0;
  const byToken = new Map<string, { incoming: number; outgoing: number; transfers: number }>();

  for (const transfer of transfers) {
    const token = typeof transfer.token === 'string' && transfer.token ? transfer.token : 'unknown';
    const row = byToken.get(token) || { incoming: 0, outgoing: 0, transfers: 0 };
    row.transfers += 1;
    if (transfer.destination === wallet) {
      incoming += 1;
      row.incoming += transfer.amount ?? 0;
    } else if (transfer.source === wallet) {
      outgoing += 1;
      row.outgoing += transfer.amount ?? 0;
    } else {
      other += 1;
    }
    byToken.set(token, row);
  }

  return {
    transferCount: transfers.length,
    incomingTransferCount: incoming,
    outgoingTransferCount: outgoing,
    unrelatedTransferCount: other,
    byToken: [...byToken.entries()].slice(0, 50).map(([token, value]) => ({ token, ...value })),
  };
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
    const rpcTransactions = rpcResult.signatures.slice(0, MAX_TXS).map((item: any) => ({
      signature: item?.signature ?? null,
      blockTime: numeric(item?.blockTime),
      status: item?.err ? 'failed' : 'success',
      slot: numeric(item?.slot),
      fee: null,
      actions: [],
      programs: [],
    }));
    const transactions = fmTransactions.length ? fmTransactions : rpcTransactions;
    const successful = rpcResult.signatures.filter((item: any) => !item?.err);
    const failed = rpcResult.signatures.length - successful.length;
    const balanceSol = rpcResult.balanceLamports / 1_000_000_000;
    const firstActivity = successful[successful.length - 1]?.blockTime ?? null;
    const lastActivity = successful[0]?.blockTime ?? null;
    const now = Math.floor(Date.now() / 1000);
    const walletAgeDays = firstActivity ? Math.max(0, Math.floor((now - firstActivity) / 86400)) : null;
    const flows = summarizeFlows(transfers, address);
    const protocols = extractProtocolCandidates(transactions);
    const security = await getTokenSecurity(context.env, tokens.map((t: any) => t?.mint).filter(Boolean));
    const riskFlagCount = security.reduce((count, token: any) => count + token.riskFlags.length, 0);

    return response({
      success: true,
      version: 'v3',
      source: {
        rpc: context.env.SOLANA_RPC_URL ? 'configured-rpc-with-fallbacks' : 'solana-public-rpc-with-fallbacks',
        enriched: fmResult.available ? 'solanafm-free' : 'rpc-only',
        market: solPriceUsd === null ? null : 'dexscreener-public',
      },
      wallet: {
        address,
        network: 'solana-mainnet',
        mode: 'read-only',
      },
      observedAt: new Date().toISOString(),
      overview: {
        walletAgeDays,
        firstActivity,
        lastActivity,
        transactionsSampled: transactions.length,
        successfulTransactionsSampled: successful.length,
        failedTransactionsSampled: failed,
        tokenAccounts: rpcResult.tokenAccounts.length,
        nonZeroTokens: rpcResult.nonZeroTokens.length,
        nftCount: tokens.filter((t: any) => t.type === 'NonFungible' || t.type === 'CompressedNonFungible').length,
      },
      balance: {
        lamports: rpcResult.balanceLamports,
        sol: balanceSol,
        priceUsd: solPriceUsd,
        valueUsd: solPriceUsd === null ? null : balanceSol * solPriceUsd,
      },
      portfolio: {
        tokenAccountCount: rpcResult.tokenAccounts.length,
        nonZeroTokenCount: rpcResult.nonZeroTokens.length,
        nftCount: tokens.filter((t: any) => t.type === 'NonFungible' || t.type === 'CompressedNonFungible').length,
        assets: tokens.slice(0, 100),
      },
      flows,
      assets: {
        tokenAccountCount: rpcResult.tokenAccounts.length,
        nonZeroTokenCount: rpcResult.nonZeroTokens.length,
        tokens: tokens.slice(0, 100),
        nftCount: tokens.filter((t: any) => t.type === 'NonFungible' || t.type === 'CompressedNonFungible').length,
      },
      activity: {
        transactionCountSampled: transactions.length,
        successfulTransactionCountSampled: successful.length,
        failedTransactionCountSampled: failed,
        transferCount: transfers.length,
        firstActivity,
        lastActivity,
        transactions: transactions.slice(0, MAX_TXS),
        transfers: transfers.slice(0, 50),
      },
      dex: {
        protocols,
        detected: protocols.length > 0,
        note: protocols.length ? 'پروتکل‌ها از داده‌های طبقه‌بندی‌شده تراکنش‌ها/Actionها استخراج شده‌اند.' : 'در نمونه تراکنش فعلی، فعالیت DEX قابل انتساب شناسایی نشد.',
      },
      security: {
        analyzedTokenCount: security.length,
        flaggedTokenCount: security.filter((token: any) => token.riskFlags.length > 0).length,
        totalRiskFlags: riskFlagCount,
        tokens: security,
        methodology: 'Flags are descriptive on-chain signals, not a scam verdict.',
      },
      analysis: {
        pnl: null,
        tradingStats: null,
        riskScore: null,
        note: 'PnL و امتیاز ریسک کلی بدون داده تاریخی، قیمت‌گذاری و انتساب مالکیت کافی عمداً محاسبه نمی‌شوند.',
      },
      capabilities: {
        rpcBalance: true,
        rpcTokenAccounts: rpcResult.tokenAccounts.length > 0 || !rpcResult.rpcErrors.some(x => x.startsWith('token:') || x.startsWith('token2022:')),
        rpcTransactionSignatures: rpcResult.signatures.length > 0 || !rpcResult.rpcErrors.some(x => x.startsWith('signatures:')),
        solanaFmEnrichment: fmResult.available,
        solPrice: solPriceUsd !== null,
        portfolio: true,
        flows: transfers.length > 0,
        dexActivity: protocols.length > 0,
        tokenSecurity: security.length > 0,
        pnl: false,
        riskScoring: false,
      },
      diagnostics: {
        partialRpc: rpcResult.partial,
        rpcErrors: rpcResult.rpcErrors,
      },
      caveats: [
        'این گزارش فقط از داده عمومی بلاکچین و منابع داده عمومی استفاده می‌کند.',
        'آدرس عمومی به‌تنهایی هویت واقعی مالک کیف پول را اثبات نمی‌کند.',
        'Net Flow با PnL یکی نیست و در این نسخه به‌عنوان سود/زیان گزارش نمی‌شود.',
        'پرچم‌های امنیتی توکن، سیگنال‌های توصیفی هستند و به‌تنهایی اثبات Scam بودن دارایی نیستند.',
      ],
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    return serverError('WALLET_ANALYSIS_UNAVAILABLE', `دریافت داده آن‌چین کیف پول ممکن نشد. ${reason}`, 503);
  }
}
