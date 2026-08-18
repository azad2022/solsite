import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, BarChart3, CheckCircle2, FileSearch, ShieldCheck, WalletCards } from 'lucide-react';

type Props = { onNavigate: (path: string) => void };
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type WalletPayload = {
  success?: boolean;
  wallet?: { address: string; network: string; mode: string };
  balance?: { sol: number; priceUsd: number | null; valueUsd: number | null };
  overview?: { transactionsSampled: number; successfulTransactionsSampled: number; failedTransactionsSampled: number; tokenAccounts: number; nonZeroTokens: number; nftCount: number };
  flows?: { transferCount: number; incomingTransferCount: number; outgoingTransferCount: number };
  dex?: { detected: boolean; protocols: Array<{ name: string; interactions: number }> };
  security?: { analyzedTokenCount: number; flaggedTokenCount: number; totalRiskFlags: number };
  caveats?: string[];
  error?: { message?: string };
};

type TokenPayload = {
  ok?: boolean;
  mint?: string;
  tokenProgram?: string;
  decimals?: number;
  supply?: string;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  metadata?: { found?: boolean; name?: string | null; symbol?: string | null; mutable?: boolean | null };
  riskProfile?: { flags?: Array<{ code: string; severity: string; title: string; detail: string }> };
  error?: string;
};

const Card: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5"><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-slate-500">{label}</span><span className="text-[#14F195]">{icon}</span></div><strong className="mt-3 block font-mono text-xl font-black text-white">{value}</strong></div>;

export const EnglishWalletAnalyzerPage: React.FC<Props> = ({ onNavigate }) => {
  const [address, setAddress] = useState('');
  const [payload, setPayload] = useState<WalletPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const value = new URLSearchParams(window.location.search).get('address'); if (value && BASE58.test(value)) { setAddress(value); void analyze(value); } }, []);
  async function analyze(value: string) { setLoading(true); setError(''); setPayload(null); try { const response = await fetch(`/api/wallet/analyze?address=${encodeURIComponent(value)}`, { headers: { Accept: 'application/json' }, cache: 'no-store' }); const data = await response.json() as WalletPayload; if (!response.ok || !data.success) throw new Error(data.error?.message || 'Wallet analysis failed.'); setPayload(data); window.history.replaceState({}, '', `/en/wallet-analyzer?address=${encodeURIComponent(value)}`); } catch (err) { setError(err instanceof Error ? err.message : 'Wallet analysis failed.'); } finally { setLoading(false); } }
  const valid = useMemo(() => BASE58.test(address.trim()), [address]);
  return <Shell title="Solana Wallet Analyzer" description="Read-only on-chain analysis of a public Solana wallet. Private keys and seed phrases are never required."><form onSubmit={e => { e.preventDefault(); if (valid) void analyze(address.trim()); }} className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-7"><label htmlFor="english-wallet-address" className="text-sm font-bold text-white">Public wallet address</label><div className="mt-3 flex flex-col gap-3 sm:flex-row"><input id="english-wallet-address" value={address} onChange={e => { setAddress(e.target.value); setPayload(null); setError(''); }} dir="ltr" autoComplete="off" spellCheck={false} placeholder="Paste a Solana public address" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3.5 text-sm text-white outline-none focus:border-[#14F195]/60"/><button disabled={loading || !valid} className="rounded-xl bg-[#14F195] px-6 py-3.5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Analyzing…' : 'Analyze wallet'}</button></div>{address && !valid && <p className="mt-3 text-xs font-bold text-rose-400">Enter a valid Solana public address.</p>}{error && <p role="alert" className="mt-3 text-sm font-bold text-rose-400">{error}</p>}</form>
    {payload?.success && <div className="mt-8 space-y-6"><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><Card label="SOL balance" value={payload.balance ? payload.balance.sol.toLocaleString('en-US', { maximumFractionDigits: 6 }) : '—'} icon={<WalletCards className="w-4 h-4"/>}/><Card label="Sampled transactions" value={String(payload.overview?.transactionsSampled ?? 0)} icon={<Activity className="w-4 h-4"/>}/><Card label="Incoming transfers" value={String(payload.flows?.incomingTransferCount ?? 0)} icon={<ArrowDownLeft className="w-4 h-4"/>}/><Card label="Outgoing transfers" value={String(payload.flows?.outgoingTransferCount ?? 0)} icon={<ArrowUpRight className="w-4 h-4"/>}/></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><Card label="DEX activity detected" value={payload.dex?.detected ? 'Yes' : 'No'} icon={<BarChart3 className="w-4 h-4"/>}/><Card label="Tokens analyzed" value={String(payload.security?.analyzedTokenCount ?? 0)} icon={<ShieldCheck className="w-4 h-4"/>}/><Card label="Risk flags" value={String(payload.security?.totalRiskFlags ?? 0)} icon={<CheckCircle2 className="w-4 h-4"/>}/></div><div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6"><h2 className="text-lg font-black text-white">Observed wallet activity</h2><p className="mt-2 text-sm leading-7 text-slate-400">Network: {payload.wallet?.network || 'Solana'} · Mode: {payload.wallet?.mode || 'read-only'} · Token accounts: {payload.overview?.tokenAccounts ?? 0} · NFTs: {payload.overview?.nftCount ?? 0}</p>{payload.dex?.protocols?.length ? <div className="mt-4 flex flex-wrap gap-2">{payload.dex.protocols.map(protocol => <span key={protocol.name} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{protocol.name}: {protocol.interactions}</span>)}</div> : null}</div>{payload.caveats?.length ? <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm leading-7 text-amber-200"><strong>Data caveats:</strong><ul className="mt-2 list-disc pl-5">{payload.caveats.map(item => <li key={item}>{item}</li>)}</ul></div> : null}<button type="button" onClick={() => onNavigate('/en')} className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">Back to English home</button></div>}
  </Shell>;
};

export const EnglishTokenScannerPage: React.FC<Props> = ({ onNavigate }) => {
  const [mint, setMint] = useState('');
  const [result, setResult] = useState<TokenPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function analyze(value: string) { setLoading(true); setError(''); setResult(null); try { const response = await fetch(`/api/tools/solana-token?mint=${encodeURIComponent(value)}`, { cache: 'no-store' }); const data = await response.json() as TokenPayload; if (!response.ok || !data.ok) throw new Error(data.error || 'Token inspection failed.'); setResult(data); window.history.replaceState({}, '', `/en/tools/solana-token-scanner?mint=${encodeURIComponent(value)}`); } catch (err) { setError(err instanceof Error ? err.message : 'Token inspection failed.'); } finally { setLoading(false); } }
  useEffect(() => { const value = new URLSearchParams(window.location.search).get('mint'); if (value && BASE58.test(value)) { setMint(value); void analyze(value); } }, []);
  const valid = BASE58.test(mint.trim());
  return <Shell title="Solana Token Scanner" description="Read-only inspection of a Solana mint, its authorities, supply, token program and public metadata."><form onSubmit={e => { e.preventDefault(); if (valid) void analyze(mint.trim()); }} className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-7"><label htmlFor="english-token-mint" className="text-sm font-bold text-white">Token mint address</label><div className="mt-3 flex flex-col gap-3 sm:flex-row"><input id="english-token-mint" value={mint} onChange={e => { setMint(e.target.value); setResult(null); setError(''); }} dir="ltr" autoComplete="off" spellCheck={false} placeholder="Paste a Solana mint address" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3.5 text-sm text-white outline-none focus:border-[#14F195]/60"/><button disabled={loading || !valid} className="rounded-xl bg-[#14F195] px-6 py-3.5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Scanning…' : 'Scan token'}</button></div>{mint && !valid && <p className="mt-3 text-xs font-bold text-rose-400">Enter a valid Base58 Solana mint address.</p>}{error && <p role="alert" className="mt-3 text-sm font-bold text-rose-400">{error}</p>}</form>{result && <div className="mt-8 space-y-6"><div className="rounded-2xl border border-[#14F195]/20 bg-[#14F195]/5 p-5"><span className="text-xs font-bold text-[#14F195]">Token program</span><p className="mt-2 text-lg font-black text-white">{result.tokenProgram || 'Unknown'}</p><p className="mt-2 break-all font-mono text-xs text-slate-300">{result.mint}</p></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><Card label="Supply" value={result.supply || '—'} icon={<Activity className="w-4 h-4"/>}/><Card label="Decimals" value={String(result.decimals ?? '—')} icon={<BarChart3 className="w-4 h-4"/>}/><Card label="Mint authority" value={result.mintAuthority ? 'Active' : 'Revoked'} icon={<ShieldCheck className="w-4 h-4"/>}/><Card label="Freeze authority" value={result.freezeAuthority ? 'Active' : 'Revoked'} icon={<ShieldCheck className="w-4 h-4"/>}/></div><div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6"><h2 className="text-lg font-black text-white">Metadata</h2><div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4"><Card label="Name" value={result.metadata?.name || '—'} icon={<FileSearch className="w-4 h-4"/>}/><Card label="Symbol" value={result.metadata?.symbol || '—'} icon={<FileSearch className="w-4 h-4"/>}/><Card label="Mutable" value={result.metadata?.mutable === null || result.metadata?.mutable === undefined ? 'Unknown' : result.metadata.mutable ? 'Yes' : 'No'} icon={<CheckCircle2 className="w-4 h-4"/>}/><Card label="Risk flags" value={String(result.riskProfile?.flags?.length ?? 0)} icon={<ShieldCheck className="w-4 h-4"/>}/></div></div><button type="button" onClick={() => onNavigate('/en/tools/token-2022-inspector')} className="rounded-xl border border-[#9945FF]/30 bg-[#9945FF]/5 px-5 py-3 text-sm font-bold text-white hover:bg-[#9945FF]/10">Open Token-2022 Inspector</button></div>} </Shell>;
};

const Shell: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => <section className="relative overflow-hidden py-12 sm:py-16"><div className="mx-auto max-w-6xl px-4 sm:px-6"><div className="max-w-4xl"><span className="text-xs font-bold uppercase tracking-[.18em] text-[#14F195]">Solmint Tools</span><h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight text-white">{title}</h1><p className="mt-4 text-sm sm:text-base leading-8 text-slate-400">{description}</p></div>{children}</div></section>;
