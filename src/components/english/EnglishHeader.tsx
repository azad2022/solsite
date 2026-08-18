import React from 'react';
import { BookOpen, ChevronDown, FileSearch, Menu, ShieldCheck, User, Wrench, X } from 'lucide-react';
import { SolanaStatus, UserAccount } from '../../types';

type Props = { currentPath: string; onNavigate: (path: string) => void; solanaStatus: SolanaStatus; currentUser: UserAccount | null; openAuth: () => void };

const linkClass = (active: boolean) => `shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${active ? 'bg-white/10 text-white font-bold' : 'text-slate-300 hover:text-white'}`;

export const EnglishHeader: React.FC<Props> = ({ currentPath, onNavigate, currentUser, openAuth }) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [toolsOpen, setToolsOpen] = React.useState(false);
  const go = (path: string) => { setMobileOpen(false); setToolsOpen(false); onNavigate(path); };
  const links = [
    ['/en', 'Home'],
    ['/en/solana-wallet', 'Solana Wallet'],
    ['/en/wallet-analyzer', 'Wallet Analysis'],
    ['/en/solana-price', 'Live SOL Price'],
    ['/en/solana-token', 'Token Creator'],
    ['/en/solana-meme-coin', 'Meme Coin'],
    ['/en/solana-nft', 'NFT'],
    ['/en/security', 'Security'],
    ['/en/faq', 'FAQ'],
    ['/en/app-guide', 'App Guide'],
    ['/en/download', 'Android App'],
    ['/en/blog', 'Blog & Academy']
  ];
  return <header dir="ltr" className="relative w-full z-40 bg-[#05050a]/90 backdrop-blur-xl border-b border-white/[0.08]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
      <button type="button" onClick={() => go('/en')} className="flex items-center gap-2.5 cursor-pointer shrink-0" aria-label="Solmint Home"><div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#9945FF] via-[#14F195] to-[#00C2FF] p-0.5 shadow-lg shadow-[#9945FF]/20 flex items-center justify-center"><div className="w-full h-full bg-[#05050a] rounded-[10px] flex items-center justify-center p-2"><span className="text-white font-black text-lg">S</span></div></div><span className="hidden sm:block font-extrabold text-lg text-white">Solmint</span></button>
      <nav className="hidden xl:flex items-center gap-0.5 bg-white/[0.03] p-1 rounded-full border border-white/10 whitespace-nowrap">
        {links.slice(0, 7).map(([path, label]) => <a key={path} href={path} onClick={e => { e.preventDefault(); go(path); }} className={linkClass(currentPath === path)}>{label}</a>)}
        <a href="/en/security" onClick={e => { e.preventDefault(); go('/en/security'); }} className={linkClass(currentPath === '/en/security')}>Security</a>
        <div className="relative" onMouseEnter={() => setToolsOpen(true)} onMouseLeave={() => setToolsOpen(false)}><button type="button" onClick={() => go('/en/tools')} className={`${linkClass(currentPath.startsWith('/en/tools'))} inline-flex items-center gap-1`}><Wrench className="w-3.5 h-3.5" />Tools<ChevronDown className={`w-3 h-3 ${toolsOpen ? 'rotate-180' : ''}`} /></button>{toolsOpen && <div className="absolute left-0 top-full pt-2 w-72"><div className="rounded-2xl border border-white/10 bg-[#0a0a12]/98 p-2 shadow-2xl"><button type="button" onClick={() => go('/en/tools')} className="w-full text-left rounded-xl px-3 py-3 hover:bg-white/5 text-white font-bold">All Solana Tools</button><button type="button" onClick={() => go('/en/tools/solana-token-tools')} className="w-full text-left rounded-xl px-3 py-3 hover:bg-white/5 text-slate-200">Solana Token Tools</button><button type="button" onClick={() => go('/en/tools/solana-token-scanner')} className="w-full text-left rounded-xl px-3 py-3 hover:bg-white/5 text-slate-200">Solana Token Scanner</button><button type="button" onClick={() => go('/en/tools/token-2022-inspector')} className="w-full text-left rounded-xl px-3 py-3 hover:bg-white/5 text-slate-200">Token-2022 Inspector</button></div></div>}</div>
        {links.slice(7).map(([path, label]) => <a key={path} href={path} onClick={e => { e.preventDefault(); go(path); }} className={linkClass(currentPath === path)}>{label}</a>)}
        <a href="/" onClick={e => { e.preventDefault(); go('/'); }} className="px-2.5 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white">فارسی</a>
      </nav>
      <div className="hidden sm:flex items-center gap-2"><button type="button" onClick={openAuth} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-bold"><User className="w-4 h-4 text-[#14F195]" />{currentUser ? currentUser.fullName : 'Login / Sign up'}</button></div>
      <button type="button" onClick={() => setMobileOpen(v => !v)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} className="xl:hidden p-2 rounded-xl bg-white/5 text-slate-300 hover:text-white"><span className="sr-only">Menu</span>{mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
    </div>
    {mobileOpen && <div className="xl:hidden border-t border-white/10 bg-[#05050a] px-4 py-4 space-y-2">{links.map(([path, label]) => <button key={path} type="button" onClick={() => go(path)} className={`w-full text-left px-4 py-3 rounded-xl text-sm ${currentPath === path ? 'bg-[#9945FF]/20 text-[#14F195]' : 'text-slate-300 bg-white/5'}`}>{label}</button>)}<button type="button" onClick={() => go('/en/tools')} className="w-full text-left px-4 py-3 rounded-xl text-sm text-slate-300 bg-white/5 flex items-center gap-2"><Wrench className="w-4 h-4" />Tools</button><button type="button" onClick={() => go('/')} className="w-full text-left px-4 py-3 rounded-xl text-sm text-slate-300 bg-white/5">فارسی</button></div>}
  </header>;
};
