const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const MAX_MINT_LENGTH = 44;
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1Q9fD7Jq3d3Y7h';
const METADATA_PROGRAM = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

interface Env { SOLANA_RPC_URL?: string; }
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=300', 'CDN-Cache-Control': 'public, max-age=30, stale-while-revalidate=300', 'Access-Control-Allow-Origin': 'https://solmint.ir', 'X-Content-Type-Options': 'nosniff' };
function json(data: unknown, status = 200): Response { return new Response(JSON.stringify(data), { status, headers }); }
function isValidMint(value: string): boolean { return value.length <= MAX_MINT_LENGTH && BASE58_RE.test(value); }
async function rpc(url: string, method: string, params: unknown[], timeoutMs = 8000): Promise<any> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: controller.signal, cache: 'no-store' }); if (!response.ok) throw new Error(`RPC HTTP ${response.status}`); const payload = await response.json() as any; if (payload?.error) throw new Error(payload.error.message || 'RPC request failed'); return payload?.result ?? null; } finally { clearTimeout(timer); }
}
function normalizeAuthority(value: unknown): string | null { return typeof value === 'string' ? value : null; }
function normalizeExtensions(value: unknown): Array<{ type: string; data?: unknown }> { if (!Array.isArray(value)) return []; return value.filter((item: any) => item && typeof item.type === 'string').map((item: any) => ({ type: item.type, data: item.info ?? item.data })); }
function percentOf(amount: string, total: string): string { try { const a = BigInt(amount); const t = BigInt(total); if (t <= 0n) return '0.00'; return `${Number((a * 10000n) / t) / 100}`; } catch { return '0.00'; } }
function bytesToBase58(bytes: Uint8Array): string { let value = 0n; for (const byte of bytes) value = (value << 8n) | BigInt(byte); let encoded = ''; while (value > 0n) { const remainder = Number(value % 58n); encoded = BASE58_ALPHABET[remainder] + encoded; value /= 58n; } for (const byte of bytes) { if (byte !== 0) break; encoded = `1${encoded}`; } return encoded || '1'; }
function readU32(bytes: Uint8Array, offset: number): number { return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16) | ((bytes[offset + 3] ?? 0) << 24); }
function readString(bytes: Uint8Array, offset: number): { value: string; next: number } | null { const length = readU32(bytes, offset); const start = offset + 4; const end = start + length; if (!Number.isSafeInteger(length) || length < 0 || end > bytes.length) return null; return { value: new TextDecoder().decode(bytes.slice(start, end)).replace(/\0+$/g, ''), next: end }; }
function decodeBase64(value: string): Uint8Array { const binary = atob(value); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i); return bytes; }

async function readMetaplexMetadata(rpcUrl: string, mint: string) {
  try {
    const result = await rpc(rpcUrl, 'getProgramAccounts', [METADATA_PROGRAM, { commitment: 'confirmed', encoding: 'base64', filters: [{ memcmp: { offset: 33, bytes: mint } }] }], 8000);
    const account = Array.isArray(result) ? result[0] : null; const encoded = account?.account?.data?.[0];
    if (!account || typeof encoded !== 'string') return { found: false, account: null, updateAuthority: null, name: null, symbol: null, uri: null, mutable: null };
    const bytes = decodeBase64(encoded); if (bytes.length < 69 || bytes[0] !== 4) return { found: false, account: account.pubkey ?? null, updateAuthority: null, name: null, symbol: null, uri: null, mutable: null };
    const updateAuthority = bytesToBase58(bytes.slice(1, 33)); let cursor = 65;
    const name = readString(bytes, cursor); if (!name) return { found: true, account: account.pubkey ?? null, updateAuthority, name: null, symbol: null, uri: null, mutable: null }; cursor = name.next;
    const symbol = readString(bytes, cursor); if (!symbol) return { found: true, account: account.pubkey ?? null, updateAuthority, name: name.value, symbol: null, uri: null, mutable: null }; cursor = symbol.next;
    const uri = readString(bytes, cursor); if (!uri) return { found: true, account: account.pubkey ?? null, updateAuthority, name: name.value, symbol: symbol.value, uri: null, mutable: null }; cursor = uri.next;
    cursor += 2;
    if (cursor >= bytes.length) return { found: true, account: account.pubkey ?? null, updateAuthority, name: name.value, symbol: symbol.value, uri: uri.value, mutable: null };
    const creatorsOption = bytes[cursor++] ?? 0;
    if (creatorsOption === 1 && cursor + 4 <= bytes.length) { const count = readU32(bytes, cursor); cursor += 4 + count * 34; }
    const primarySaleHappened = cursor < bytes.length ? bytes[cursor++] === 1 : null;
    const mutable = cursor < bytes.length ? bytes[cursor] === 1 : null;
    return { found: true, account: account.pubkey ?? null, updateAuthority, name: name.value, symbol: symbol.value, uri: uri.value, mutable, primarySaleHappened };
  } catch (error) { console.warn('Metaplex metadata lookup unavailable:', error); return { found: false, account: null, updateAuthority: null, name: null, symbol: null, uri: null, mutable: null }; }
}

function riskProfile(mintAuthority: string | null, freezeAuthority: string | null, top10Pct: number, token2022: boolean, extensions: Array<{ type: string }>) {
  const flags: Array<{ code: string; severity: 'info' | 'warning' | 'high'; title: string; detail: string }> = [];
  if (mintAuthority) flags.push({ code: 'mint-authority', severity: 'warning', title: 'Mint Authority فعال است', detail: 'دارنده این Authority از نظر فنی می‌تواند عرضه توکن را افزایش دهد.' }); else flags.push({ code: 'mint-authority-revoked', severity: 'info', title: 'Mint Authority لغو شده است', detail: 'در وضعیت فعلی Mint Authority قابل استفاده نیست.' });
  if (freezeAuthority) flags.push({ code: 'freeze-authority', severity: 'warning', title: 'Freeze Authority فعال است', detail: 'این Authority می‌تواند مطابق قوانین Token Program حساب‌های توکن را freeze کند.' }); else flags.push({ code: 'freeze-authority-revoked', severity: 'info', title: 'Freeze Authority لغو شده است', detail: 'Freeze Authority در Mint فعال نیست.' });
  if (top10Pct >= 50) flags.push({ code: 'concentration-high', severity: 'high', title: 'تمرکز بالا در ۱۰ حساب بزرگ', detail: `${top10Pct.toFixed(2)}٪ از عرضه در ۱۰ Token Account بزرگ دیده می‌شود.` }); else if (top10Pct >= 25) flags.push({ code: 'concentration-medium', severity: 'warning', title: 'تمرکز قابل توجه در ۱۰ حساب بزرگ', detail: `${top10Pct.toFixed(2)}٪ از عرضه در ۱۰ Token Account بزرگ دیده می‌شود.` });
  if (token2022 && extensions.some(extension => extension.type.toLowerCase().includes('transferfee'))) flags.push({ code: 'transfer-fee', severity: 'warning', title: 'Transfer Fee Extension فعال است', detail: 'این Token-2022 می‌تواند روی انتقال‌ها fee اعمال کند؛ جزئیات Extension را بررسی کنید.' });
  return { flags, disclaimer: 'این پروفایل فقط بر اساس داده‌های قابل مشاهده on-chain ساخته شده و نتیجه آن «امن»، «اسکم» یا توصیه سرمایه‌گذاری نیست.' };
}

export const onRequestGet = async ({ request, env }: { request: Request; env?: Env }) => {
  const url = new URL(request.url); const mint = (url.searchParams.get('mint') || '').trim(); const mode = url.searchParams.get('mode') === 'extensions' ? 'extensions' : 'token';
  if (!isValidMint(mint)) return json({ ok: false, error: 'آدرس Mint معتبر نیست.' }, 400);
  const rpcUrl = env?.SOLANA_RPC_URL || DEFAULT_RPC_URL;
  try {
    const accountResult = await rpc(rpcUrl, 'getAccountInfo', [mint, { commitment: 'confirmed', encoding: 'jsonParsed' }]); const account = accountResult?.value;
    if (!account) return json({ ok: false, error: 'این Account روی شبکه اصلی Solana پیدا نشد.' }, 404);
    const owner = account.owner; const parsed = account.data?.parsed; const info = parsed?.info; const token2022 = owner === TOKEN_2022_PROGRAM; const tokenProgram = token2022 ? 'Token-2022' : owner === TOKEN_PROGRAM ? 'SPL Token Program' : owner;
    if (!info || parsed?.type !== 'mint' || (owner !== TOKEN_PROGRAM && owner !== TOKEN_2022_PROGRAM)) return json({ ok: false, error: 'این آدرس یک Token Mint معتبر از Token Programهای شناخته‌شده نیست.' }, 422);
    const largestResult = await rpc(rpcUrl, 'getTokenLargestAccounts', [mint, { commitment: 'confirmed' }]); const largest = Array.isArray(largestResult?.value) ? largestResult.value : []; const top20 = largest.slice(0, 20);
    const addresses = top20.map((item: any) => item.address).filter(Boolean); let ownerAccounts: any[] = [];
    if (addresses.length) { const ownerResult = await rpc(rpcUrl, 'getMultipleAccounts', [addresses, { commitment: 'confirmed', encoding: 'jsonParsed' }]); ownerAccounts = Array.isArray(ownerResult?.value) ? ownerResult.value : []; }
    const largestAccounts = top20.map((item: any, index: number) => { const tokenInfo = ownerAccounts[index]?.data?.parsed?.info; return { rank: index + 1, address: item.address, amount: String(item.amount ?? '0'), uiAmount: item.uiAmountString ?? item.uiAmount ?? null, percentageOfSupply: percentOf(String(item.amount ?? '0'), String(info.supply ?? '0')), owner: typeof tokenInfo?.owner === 'string' ? tokenInfo.owner : null, delegate: typeof tokenInfo?.delegate === 'string' ? tokenInfo.delegate : null, state: tokenInfo?.state ?? null }; });
    const top10Pct = largest.slice(0, 10).reduce((sum: number, item: any) => sum + Number(percentOf(String(item.amount ?? '0'), String(info.supply ?? '0'))), 0); const extensions = normalizeExtensions(info.extensions); const mintAuthority = normalizeAuthority(info.mintAuthority); const freezeAuthority = normalizeAuthority(info.freezeAuthority);
    const metadata = await readMetaplexMetadata(rpcUrl, mint);
    const base = { ok: true, mint, tokenProgram, owner, slot: accountResult?.context?.slot ?? null, decimals: Number(info.decimals ?? 0), supply: String(info.supply ?? '0'), isInitialized: Boolean(info.isInitialized), mintAuthority, freezeAuthority, extensions, metadata, analyzedAt: new Date().toISOString(), distribution: { sampledAccounts: largestAccounts.length, top10Percentage: Number(top10Pct.toFixed(2)), source: 'getTokenLargestAccounts', accounts: largestAccounts }, riskProfile: riskProfile(mintAuthority, freezeAuthority, top10Pct, token2022, extensions) };
    if (mode === 'extensions' && !token2022) return json({ ...base, inspector: { isToken2022: false, extensions: [] } });
    return json({ ...base, inspector: { isToken2022: token2022, extensions } });
  } catch (error) { console.error('Solana token analyzer failed:', error); return json({ ok: false, error: 'دریافت اطلاعات از شبکه Solana موقتاً ناموفق بود.' }, 502); }
};
