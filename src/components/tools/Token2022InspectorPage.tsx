import React, { useMemo, useState } from 'react';

interface Props { onNavigate: (path: string) => void; }
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const extensions = [
  ['Transfer Fee', 'کارمزد انتقال'],
  ['Transfer Hook', 'هوک انتقال'],
  ['Permanent Delegate', 'Delegate دائمی'],
  ['Default Account State', 'وضعیت پیش‌فرض حساب'],
  ['Metadata Pointer', 'اشاره‌گر متادیتا'],
  ['Non-Transferable', 'غیرقابل انتقال'],
];

export const Token2022InspectorPage: React.FC<Props> = ({ onNavigate }) => {
  const [mint, setMint] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const valid = useMemo(() => BASE58.test(mint.trim()), [mint]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (valid) window.history.replaceState({}, '', `/tools/token-2022-inspector?mint=${encodeURIComponent(mint.trim())}`);
  };

  return (
    <section className="relative py-12 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <button type="button" onClick={() => onNavigate('/tools/solana-token-tools')} className="text-sm font-bold text-slate-400 hover:text-white">← ابزارهای توکن سولانا</button>
        <div className="mt-8 max-w-3xl">
          <span className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Token-2022 Inspector</span>
          <h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-white">بازرس Token-2022</h1>
          <p className="mt-4 text-sm sm:text-base leading-8 text-slate-400">Extensionهای فعال یک Mint را بررسی کنید و ببینید چه قابلیت‌های تخصصی در حساب توکن تعریف شده‌اند.</p>
        </div>

        <form onSubmit={submit} className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/80 p-5 sm:p-7">
          <label htmlFor="token-2022-mint" className="block text-sm font-bold text-slate-200">آدرس Mint</label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input id="token-2022-mint" value={mint} onChange={e => { setMint(e.target.value); setSubmitted(false); }} dir="ltr" inputMode="text" autoComplete="off" placeholder="Token-2022 Mint Address" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3.5 text-sm text-white outline-none transition focus:border-violet-400/60" />
            <button type="submit" className="rounded-xl bg-violet-500 px-6 py-3.5 text-sm font-black text-white transition hover:brightness-110">بررسی Extensionها</button>
          </div>
          {submitted && !valid && <p className="mt-3 text-xs font-bold text-rose-400">آدرس واردشده از نظر طول و قالب Base58 معتبر نیست.</p>}
        </form>

        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-950/60 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-black text-white">Extensionهای قابل بررسی</h2><p className="mt-1 text-xs text-slate-500">این فهرست پایه است و Engine بعدی وضعیت واقعی هر Mint را از chain استخراج می‌کند.</p></div>
            <span className="rounded-full border border-violet-400/20 bg-violet-400/5 px-3 py-1 text-xs font-bold text-violet-300">Read-only</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {extensions.map(([title, fa]) => (
              <div key={title} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <div><div className="text-sm font-extrabold text-slate-200">{title}</div><div className="mt-1 text-xs text-slate-500">{fa}</div></div>
                <span className="text-xs font-bold text-slate-600">Pending</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 text-sm leading-7 text-slate-400">
          <strong className="text-slate-200">مرز ابزار:</strong> Inspector فقط داده عمومی on-chain را می‌خواند و هرگز seed phrase، private key یا امضای تراکنش درخواست نمی‌کند.
        </div>
      </div>
    </section>
  );
};
