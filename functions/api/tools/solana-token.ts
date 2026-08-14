const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const MAX_MINT_LENGTH = 44;
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1Q9fD7Jq3d3Y7h';

interface Env {
  SOLANA_RPC_URL?: string;
}

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=300',
  'CDN-Cache-Control': 'public, max-age=30, stale-while-revalidate=300',
  'Access-Control-Allow-Origin': 'https://solmint.ir',
  'X-Content-Type-Options': 'nosniff'
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers });
}

function isValidMint(value: string): boolean {
  return value.length <= MAX_MINT_LENGTH && BASE58_RE.test(value);
}

async function rpc(url: string, method: string, params: unknown[], timeoutMs = 8000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const payload = await response.json() as any;
    if (payload?.error) throw new Error(payload.error.message || 'RPC request failed');
    return payload?.result ?? null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeAuthority(value: unknown): string | null {
  if (typeof value === 'string') return value;
  return null;
}

function normalizeExtensions(value: unknown): Array<{ type: string; data?: unknown }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item: any) => item && typeof item === 'object' && typeof item.type === 'string')
    .map((item: any) => ({ type: item.type, data: item.info ?? item.data }));
}

export const onRequestGet = async ({ request, env }: { request: Request; env?: Env }) => {
  const url = new URL(request.url);
  const mint = (url.searchParams.get('mint') || '').trim();
  const mode = url.searchParams.get('mode') === 'extensions' ? 'extensions' : 'token';

  if (!isValidMint(mint)) {
    return json({ ok: false, error: 'آدرس Mint معتبر نیست.' }, 400);
  }

  const rpcUrl = env?.SOLANA_RPC_URL || DEFAULT_RPC_URL;

  try {
    const result = await rpc(rpcUrl, 'getAccountInfo', [mint, {
      commitment: 'confirmed',
      encoding: 'jsonParsed'
    }]);

    const account = result?.value;
    if (!account) return json({ ok: false, error: 'این Account روی شبکه اصلی Solana پیدا نشد.' }, 404);

    const owner = account.owner;
    const parsed = account.data?.parsed;
    const info = parsed?.info;
    const program = parsed?.type === 'mint' ? (parsed?.info ? 'token-mint' : parsed?.type) : parsed?.type;
    const tokenProgram = owner === TOKEN_2022_PROGRAM ? 'Token-2022' : owner === TOKEN_PROGRAM ? 'SPL Token Program' : owner;

    if (!info || parsed?.type !== 'mint' || (owner !== TOKEN_PROGRAM && owner !== TOKEN_2022_PROGRAM)) {
      return json({ ok: false, error: 'این آدرس یک Token Mint معتبر از Token Programهای شناخته‌شده نیست.' }, 422);
    }

    const base = {
      ok: true,
      mint,
      tokenProgram,
      owner,
      slot: result?.context?.slot ?? null,
      decimals: Number(info.decimals ?? 0),
      supply: String(info.supply ?? '0'),
      isInitialized: Boolean(info.isInitialized),
      mintAuthority: normalizeAuthority(info.mintAuthority),
      freezeAuthority: normalizeAuthority(info.freezeAuthority),
      extensions: normalizeExtensions(info.extensions),
      rawType: program,
      analyzedAt: new Date().toISOString()
    };

    if (mode === 'extensions' && owner !== TOKEN_2022_PROGRAM) {
      return json({ ...base, ok: true, inspector: { isToken2022: false, extensions: [] } });
    }

    return json({ ...base, inspector: { isToken2022: owner === TOKEN_2022_PROGRAM, extensions: base.extensions } });
  } catch (error) {
    console.error('Solana token analyzer failed:', error);
    return json({ ok: false, error: 'دریافت اطلاعات از شبکه Solana موقتاً ناموفق بود.' }, 502);
  }
};
