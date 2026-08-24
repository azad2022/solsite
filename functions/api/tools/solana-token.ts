const DEFAULT_RPC_URL = 'https://solana-rpc.publicnode.com';
const FALLBACK_RPC_URLS = ['https://api.mainnet-beta.solana.com'];
const MAX_MINT_LENGTH = 44;
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJYbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1Q9fD7j3Y7h';

interface Env {
  SOLANA_RPC_URL?: string;
}

type Authority = string | null;
type Extension = { type: string; data?: unknown };

const baseHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=15, s-maxage=15, stale-while-revalidate=60',
  'CDN-Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
  'Access-Control-Allow-Origin': 'https://solmint.ir',
  'X-Content-Type-Options': 'nosniff',
};

function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...baseHeaders, ...extra },
  });
}

function isValidMint(value: string) {
  return value.length <= MAX_MINT_LENGTH && BASE58_RE.test(value);
}

async function rpc(url: string, method: string, params: unknown[], timeoutMs = 5000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);

    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('RPC پاسخ JSON معتبر برنگرداند.');
    }

    if (payload?.error) {
      throw new Error(payload.error.message || 'RPC request failed');
    }

    return payload?.result ?? null;
  } finally {
    clearTimeout(timer);
  }
}

async function rpcWithFallback(rpcUrl: string, method: string, params: unknown[]) {
  const urls = Array.from(new Set([rpcUrl, ...FALLBACK_RPC_URLS]));
  let lastError = 'RPC request failed';

  for (const url of urls) {
    try {
      const result = await rpc(url, method, params);
      return { result, rpcUrl: url };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(lastError);
}

function normalizeAuthority(value: unknown): Authority {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeExtensions(value: unknown): Extension[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item: any) => item && typeof item.type === 'string')
    .map((item: any) => ({ type: item.type, data: item.info ?? item.data }));
}

function makeRiskProfile(
  mintAuthority: Authority,
  freezeAuthority: Authority,
  extensions: Extension[],
) {
  const flags: Array<{
    code: string;
    severity: 'info' | 'warning' | 'high';
    title: string;
    detail: string;
  }> = [];

  flags.push(
    mintAuthority
      ? {
          code: 'mint-authority',
          severity: 'warning',
          title: 'Mint Authority فعال است',
          detail: 'دارنده این Authority از نظر فنی می‌تواند عرضه توکن را افزایش دهد.',
        }
      : {
          code: 'mint-authority-revoked',
          severity: 'info',
          title: 'Mint Authority لغو شده است',
          detail: 'در وضعیت فعلی Mint Authority قابل استفاده نیست.',
        },
  );

  flags.push(
    freezeAuthority
      ? {
          code: 'freeze-authority',
          severity: 'warning',
          title: 'Freeze Authority فعال است',
          detail: 'این Authority می‌تواند مطابق قوانین Token Program حساب‌های توکن را freeze کند.',
        }
      : {
          code: 'freeze-authority-revoked',
          severity: 'info',
          title: 'Freeze Authority لغو شده است',
          detail: 'Freeze Authority در Mint فعال نیست.',
        },
  );

  for (const extension of extensions) {
    if (['TransferFeeConfig', 'TransferHook', 'PermanentDelegate', 'Pausable'].includes(extension.type)) {
      flags.push({
        code: extension.type,
        severity: 'warning',
        title: `${extension.type} فعال است`,
        detail: 'این Extension می‌تواند رفتار انتقال یا اختیارات توکن را تغییر دهد و باید جزئیات آن بررسی شود.',
      });
    }
  }

  return {
    flags,
    disclaimer:
      'این پروفایل فقط بر اساس داده‌های قابل مشاهده on-chain ساخته شده و نتیجه آن «امن»، «اسکم» یا توصیه سرمایه‌گذاری نیست.',
  };
}

export const onRequestOptions = () =>
  json(null, 204, {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });

export const onRequestGet = async ({
  request,
  env,
}: {
  request: Request;
  env?: Env;
}) => {
  const url = new URL(request.url);
  const mint = (url.searchParams.get('mint') || '').trim();
  const mode = url.searchParams.get('mode') === 'extensions' ? 'extensions' : 'token';

  if (!isValidMint(mint)) {
    return json({ ok: false, error: 'آدرس Mint معتبر نیست (باید یک رشته Base58 معتبر بین ۳۲ تا ۴۴ کاراکتر باشد).' }, 400);
  }

  const rpcUrl = env?.SOLANA_RPC_URL || DEFAULT_RPC_URL;

  try {
    const { result } = await rpcWithFallback(rpcUrl, 'getAccountInfo', [
      mint,
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ]);

    const value = result?.value;
    if (!value) {
      return json({ ok: false, error: 'این Mint Account در شبکه Solana پیدا نشد.' }, 404);
    }

    const owner = typeof value.owner === 'string' ? value.owner : '';
    const parsed = value.data?.parsed;
    const info = parsed?.info;
    const tokenProgram =
      owner === TOKEN_2022_PROGRAM
        ? 'Token-2022'
        : owner === TOKEN_PROGRAM
          ? 'SPL Token'
          : owner || 'Unknown';

    if (parsed?.type !== 'mint' || !info) {
      return json(
        {
          ok: false,
          error: 'این آدرس یک Mint Account معتبر برای Token Program نیست.',
        },
        422,
      );
    }

    const mintAuthority = normalizeAuthority(info.mintAuthority);
    const freezeAuthority = normalizeAuthority(info.freezeAuthority);
    const decimals = Number(info.decimals ?? 0);
    const supply = typeof info.supply === 'string' ? info.supply : String(info.supply ?? '0');
    const extensions = normalizeExtensions(info.extensions);

    const response: any = {
      ok: true,
      mint,
      tokenProgram,
      owner,
      slot: typeof result.context?.slot === 'number' ? result.context.slot : null,
      decimals,
      supply,
      isInitialized: Boolean(info.isInitialized),
      mintAuthority,
      freezeAuthority,
      extensions,
      analyzedAt: new Date().toISOString(),
      riskProfile: makeRiskProfile(mintAuthority, freezeAuthority, extensions),
    };

    if (mode === 'extensions') {
      response.extensions = extensions;
      response.extensionCount = extensions.length;
      response.inspector = {
        isToken2022: tokenProgram === 'Token-2022',
        extensions,
      };
    }

    return json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطای ناشناخته در ارتباط با شبکه Solana.';
    return json(
      {
        ok: false,
        error: 'دریافت اطلاعات از شبکه Solana موقتاً ناموفق بود.',
        detail: message,
      },
      502,
      { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' },
    );
  }
};
