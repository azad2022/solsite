import React, { useEffect, useMemo, useState } from 'react';
import { applyToolSeo } from '../../utils/toolsSeo';

interface Props { onNavigate: (path: string) => void; }
interface ExtensionItem { type: string; data?: unknown; }
interface TokenResult {
  ok: boolean; mint: string; tokenProgram: string; owner: string; slot: number | null; decimals: number; supply: string;
  mintAuthority: string | null; freezeAuthority: string | null; extensions: ExtensionItem[];
  inspector?: { isToken2022: boolean; extensions: ExtensionItem[] }; error?: string;
}
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const labels: Record<string, string> = {
  TransferFeeConfig: 'Transfer Fee', TransferHook: 'Transfer Hook', PermanentDelegate: 'Permanent Delegate', DefaultAccountState: 'Default Account State', MetadataPointer: 'Metadata Pointer', NonTransferable: 'Non-Transferable', InterestBearingConfig: 'Interest Bearing Config', ConfidentialTransferMint: 'Confidential Transfer', ConfidentialTransferFeeConfig: 'Confidential Transfer Fee', TransferFeeAmount: 'Transfer Fee Amount', TransferHookAccount: 'Transfer Hook Account', Metadata: 'Token Metadata', TokenMetadata: 'Token Metadata', GroupPointer: 'Group Pointer', GroupMemberPointer: 'Group Member Pointer', Group: 'Token Group', TokenGroup: 'Token Group', GroupMember: 'Token Group Member', TokenGroupMember: 'Token Group Member', Pausable: 'Pausable', MintCloseAuthority: 'Mint Close Authority', ImmutableOwner: 'Immutable Owner', MemoTransfer: 'Memo Transfer', ConfidentialTransferAccount: 'Confidential Transfer Account', ConfidentialTransferFeeAmount: 'Confidential Transfer Fee Amount', ScaledUiAmountConfig: 'Scaled UI Amount'
};
const fieldLabels: Record<string, string> = {
  transferFeeConfigAuthority: 'Transfer fee authority', withdrawWithheldAuthority: 'Withdraw authority', transferFeeBasisPoints: 'Fee (basis points)', maximumFee: 'Maximum fee', olderTransferFee: 'Previous fee configuration', newerTransferFee: 'Current fee configuration', epoch: 'Epoch', transferHookProgramId: 'Transfer Hook program', authority: 'Authority', metadataAddress: 'Metadata address', groupAddress: 'Group address', memberAddress: 'Member address', defaultAccountState: 'Default account state', defaultState: 'Default state', rate: 'Rate', interestRate: 'Interest rate', mintCloseAuthority: 'Mint close authority'
};

function formatDetail(value: unknown, key = ''): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  if (Array.isArray(value)) return value.map(item => formatDetail(item)).join(', ');
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${fieldLabels[k] || k}: ${formatDetail(v, k)}`).join(' · ');
  return String(value);
}
function extensionEntries(data: unknown): Array<[string, unknown]> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  return Object.entries(data as Record<string, unknown>).filter(([key, value]) => value !== undefined && value !== null && key !== 'type');
}

export const Token2022InspectorPage: React.FC<Props> = ({ onNavigate }) => {
  const [mint, setMint] = useState(''); const [submitted, setSubmitted] = useState(false); const [loading, setLoading] = useState(false); const [result, setResult] = useState<TokenResult | null>(null); const [error, setError] = useState('');
  const valid = useMemo(() => BASE58.test(mint.trim()), [mint]);
  useEffect(() => {
    applyToolSeo({ title: 'Token-2022 Inspector | بررسی Token Extensions سولانا | سولمینت', description: 'بررسی Token-2022 و Extensionهای آن روی شبکه سولانا؛ مشاهده قابلیت‌های واقعی Mint بدون اتصال کیف پول.', path: '/tools/token-2022-inspector' });
    const queryMint = new URLSearchParams(window.location.search).get('mint'); if (queryMint && BASE58.test(queryMint)) { setMint(queryMint); void analyze(queryMint); }
  }, []);
  async function analyze(address: string) { setLoading(true); setError(''); setResult(null); try { const response = await fetch(`/api/tools/solana-token?mint=${encodeURIComponent(address)}&mode=extensions`); const payload = await response.json() as TokenResult; if (!response.ok || !payload.ok) throw new Error(payload.error || 'دریافت اطلاعات ناموفق بود.'); setResult(payload); window.history.replaceState({}, '', `/tools/token-2022-inspector?mint=${encodeURIComponent(address)}`); } catch (err) { setError(err instanceof Error ? err.message : 'خطای نامشخص در دریافت اطلاعات.'); } finally { setLoading(false); } }
  const submit = (event: React.FormEvent) => { event.preventDefault(); setSubmitted(true); if (valid) void analyze(mint.trim()); };
  const active = result?.inspector?.extensions ?? [];
  return <section className="relative py-12 sm:py-16"><div className="mx-auto max-w-5xl px-4 sm:px-6">
    <button type="button" onClick={() => onNavigate('/tools/solana-token-tools')} className="text-sm font-bold text-slate-400 hover:text-white">← ابزارهای توکن سولانا</button>
    <div className="mt-8 max-w-3xl"><span className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Token-2022 Inspector</span><h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-white">بازرس Token-2022</h1><p className="mt-4 text-sm sm:text-base leading-8 text-slate-400">یک Mint را وارد کنید تا برنامه توکن و Extensionهای واقعی آن مستقیماً از شبکه بررسی شود.</p></div>
    <form onSubmit={submit} className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/80 p-5 sm:p-7"><label htmlFor="token-2022-mint" className="block text-sm font-bold text-slate-200">آدرس Mint</label><div className="mt-3 flex flex-col gap-3 sm:flex-row"><input id="token-2022-mint" value={mint} onChange={e => { setMint(e.target.value); setSubmitted(false); setError(''); setResult(null); }} dir="ltr" inputMode="text" autoComplete="off" placeholder="Token-2022 Mint Address" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3.5 text-sm text-white outline-none transition focus:border-violet-400/60" /><button disabled={loading} type="submit" className="rounded-xl bg-violet-500 px-6 py-3.5 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">{loading ? 'در حال بررسی…' : 'بررسی Extensionها'}</button></div>{submitted && !valid && <p className="mt-3 text-xs font-bold text-rose-400">آدرس واردشده از نظر طول و قالب Base58 معتبر نیست.</p>}{error && <p role="alert" className="mt-3 text-sm font-bold text-rose-400">{error}</p>}</form>
    {result && <div className="mt-8 space-y-5"><div className="rounded-2xl border border-violet-400/20 bg-violet-400/5 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-xs font-bold text-violet-300">بررسی on-chain انجام شد</span><p dir="ltr" className="mt-2 break-all font-mono text-xs text-slate-300">{result.mint}</p></div><span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-300">{result.tokenProgram}</span></div></div>
      {!result.inspector?.isToken2022 ? <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5"><h2 className="text-base font-black text-white">این Mint از Token-2022 استفاده نمی‌کند</h2><p className="mt-2 text-sm leading-7 text-slate-400">برنامه این Mint، SPL Token Program معمولی است. برای اطلاعات پایه آن از Token Scanner استفاده کنید.</p><button type="button" onClick={() => onNavigate(`/tools/solana-token-scanner?mint=${encodeURIComponent(result.mint)}`)} className="mt-4 rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-white">باز کردن Token Scanner</button></div> : <><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"><p className="text-xs text-slate-500">Supply</p><p dir="ltr" className="mt-3 text-sm font-extrabold text-white">{result.supply}</p></div><div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"><p className="text-xs text-slate-500">Decimals</p><p className="mt-3 text-sm font-extrabold text-white">{result.decimals}</p></div><div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"><p className="text-xs text-slate-500">Extensions فعال</p><p className="mt-3 text-sm font-extrabold text-white">{active.length}</p></div></div>
        <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5 sm:p-7"><h2 className="text-xl font-black text-white">Extensionهای واقعی Mint</h2><p className="mt-1 text-xs text-slate-500">نام و جزئیات زیر از داده parsed مربوط به Mint روی شبکه خوانده شده‌اند.</p>{active.length ? <div className="mt-6 space-y-3">{active.map((item, index) => { const entries = extensionEntries(item.data); return <article key={`${item.type}-${index}`} className="rounded-2xl border border-violet-400/15 bg-slate-900/60 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-extrabold text-slate-100">{labels[item.type] || item.type}</div><div className="mt-1 text-xs font-mono text-violet-300/70">{item.type}</div></div><span className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] font-bold text-slate-400">on-chain</span></div>{entries.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{entries.map(([key, value]) => <div key={key} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><div className="text-[11px] text-slate-500">{fieldLabels[key] || key}</div><div dir={typeof value === 'string' && value.length > 20 ? 'ltr' : undefined} className="mt-1 break-words text-xs font-bold text-slate-200">{formatDetail(value, key)}</div></div>)}</div>}{entries.length === 0 && <p className="mt-3 text-xs text-slate-500">این Extension در پاسخ parsed فعلی داده تکمیلی قابل نمایش ندارد.</p>}</article>; })}</div> : <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-400">برای این Mint، Extension قابل تشخیصی در پاسخ parsed شبکه گزارش نشد.</div>}</div></>}
    </div>}
    <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-sm leading-7 text-slate-400"><strong className="text-slate-200">مرز ابزار:</strong> Inspector فقط داده عمومی on-chain را می‌خواند و هرگز seed phrase، private key یا امضای تراکنش درخواست نمی‌کند. وجود یک Extension به‌تنهایی نشانه خوب یا بد بودن پروژه نیست.</div>
  </div></section>;
};
