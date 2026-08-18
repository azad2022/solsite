import React from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Coins, Download, FileSearch, Flame, HelpCircle, KeyRound, Lock, ShieldCheck, Smartphone, Sparkles, Wrench, Zap } from 'lucide-react';

type Props = { onNavigate: (path: string) => void };

type IconCard = {
  icon: React.ElementType;
  title: string;
  body: string;
};

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div dir="ltr" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-14">{children}</div>
);

const Hero: React.FC<{ eyebrow: string; title: React.ReactNode; body: string; icon: React.ReactNode; actions?: React.ReactNode }> = ({ eyebrow, title, body, icon, actions }) => (
  <div className="text-center space-y-6 max-w-4xl mx-auto">
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#9945FF]/10 border border-[#9945FF]/30 text-[#14F195] text-xs font-bold">{icon}<span>{eyebrow}</span></div>
    <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">{title}</h1>
    <p className="text-slate-300 text-sm sm:text-base leading-8 max-w-3xl mx-auto">{body}</p>
    {actions && <div className="flex flex-wrap justify-center gap-3 pt-2">{actions}</div>}
  </div>
);

const PrimaryButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black font-extrabold text-sm shadow-xl shadow-[#9945FF]/20 hover:scale-[1.02] transition-all inline-flex items-center gap-2">{children}</button>
);

const SecondaryButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-bold text-sm transition-all inline-flex items-center gap-2">{children}</button>
);

const walletCards: IconCard[] = [
  { icon: KeyRound, title: 'User-controlled keys', body: 'The wallet is designed around locally controlled signing material rather than a custodial server model.' },
  { icon: Zap, title: 'Fast Solana transactions', body: 'Use Solana infrastructure for fast confirmations and low network costs.' },
  { icon: Coins, title: 'SPL token support', body: 'Manage SOL and standard Solana assets from the same non-custodial experience.' }
];

export const EnglishWalletPage: React.FC<Props> = ({ onNavigate }) => (
  <Shell>
    <Hero icon={<ShieldCheck className="w-4 h-4" />} eyebrow="Non-custodial Solana wallet" title={<>A non-custodial Solana wallet built around user-controlled keys</>} body="Solmint is designed so signing authority stays with the user. The website explains the wallet architecture, while sensitive signing is handled locally by the Android application." actions={<><PrimaryButton onClick={() => onNavigate('/en/download')}><Download className="w-4 h-4" />Download the Android app</PrimaryButton><SecondaryButton onClick={() => onNavigate('/en/security')}><Lock className="w-4 h-4" />Read the security architecture</SecondaryButton></>} />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{walletCards.map(({ icon: Icon, title, body }) => <article key={title} className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 space-y-4"><div className="w-12 h-12 rounded-2xl bg-[#9945FF]/20 text-[#14F195] flex items-center justify-center border border-[#9945FF]/30"><Icon className="w-6 h-6" /></div><h2 className="text-lg font-bold text-white">{title}</h2><p className="text-sm text-slate-300 leading-7">{body}</p></article>)}</div>
    <section className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-[#0a0a16] to-[#120c24] border border-[#9945FF]/30 space-y-4"><h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Smartphone className="w-6 h-6 text-[#14F195]" />Why the Android app matters</h2><p className="text-sm text-slate-300 leading-8">Solmint keeps the public website focused on information, tooling and education while the wallet application handles sensitive signing operations locally. This separation reduces the amount of trust placed in the public web surface.</p></section>
  </Shell>
);

export const EnglishTokenPage: React.FC<Props> = ({ onNavigate }) => (
  <Shell><Hero icon={<Coins className="w-4 h-4" />} eyebrow="SPL token creation" title={<>Create and manage Solana tokens with Solmint</>} body="Use a guided workflow for token metadata, mint creation and wallet-controlled signing without building the full transaction flow yourself." actions={<PrimaryButton onClick={() => onNavigate('/en/download')}><Download className="w-4 h-4" />Explore the Android app</PrimaryButton>} />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">{['Define token details', 'Add logo and metadata', 'Sign the mint transaction', 'Manage the resulting asset'].map((title, i) => <article key={title} className="p-6 rounded-3xl bg-slate-900 border border-white/10 space-y-3"><span className="text-xs font-mono font-bold text-[#14F195]">{i + 1}. {title}</span><p className="text-sm text-slate-300 leading-7">A clear production-oriented step in the token creation workflow.</p></article>)}</div>
  </Shell>
);

export const EnglishMemeCoinPage: React.FC<Props> = ({ onNavigate }) => (
  <Shell><Hero icon={<Flame className="w-4 h-4" />} eyebrow="Meme coin tools" title={<>Build a Solana meme coin with a clearer, safer workflow</>} body="Solmint provides educational and practical tooling around mint configuration, token authorities and launch preparation so users can understand what they are signing." actions={<PrimaryButton onClick={() => onNavigate('/en/download')}><Download className="w-4 h-4" />Open the app page</PrimaryButton>} />
    <div className="grid md:grid-cols-3 gap-6">{['Mint Authority', 'Freeze Authority', 'Launch preparation'].map(title => <article key={title} className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 space-y-3"><h2 className="text-lg font-bold text-white">{title}</h2><p className="text-sm text-slate-300 leading-7">Understand the relevant token controls before you publish a Solana asset.</p></article>)}</div>
  </Shell>
);

export const EnglishNftPage: React.FC<Props> = ({ onNavigate }) => (
  <Shell><Hero icon={<Sparkles className="w-4 h-4" />} eyebrow="Solana NFT" title={<>Understand and work with NFTs across the Solana ecosystem</>} body="Solmint's NFT surface is designed to explain the core concepts, metadata flow and practical tooling around Solana digital assets." actions={<SecondaryButton onClick={() => onNavigate('/en/blog')}><BookOpen className="w-4 h-4" />Read Web3 research</SecondaryButton>} />
    <div className="grid md:grid-cols-3 gap-6">{['Metadata', 'On-chain ownership', 'Practical tooling'].map(title => <article key={title} className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 space-y-3"><h2 className="text-lg font-bold text-white">{title}</h2><p className="text-sm text-slate-300 leading-7">Learn how the pieces fit together before interacting with a production asset.</p></article>)}</div>
  </Shell>
);

export const EnglishSecurityPage: React.FC<Props> = ({ onNavigate }) => (
  <Shell><Hero icon={<Lock className="w-4 h-4" />} eyebrow="Security" title={<>Security starts with minimizing what the web layer can control</>} body="Solmint's architecture is intended to separate public content and tooling from sensitive wallet signing. The server should not become the custodian of user private keys." actions={<SecondaryButton onClick={() => onNavigate('/en/solana-wallet')}><ShieldCheck className="w-4 h-4" />Review wallet architecture</SecondaryButton>} />
    <div className="grid md:grid-cols-2 gap-6">{[["Local signing", "Sensitive wallet operations are designed to stay on the user's device."], ["Server-authoritative APIs", 'Authentication and publishing APIs validate authorization on the server instead of trusting browser state.'], ["Open-source direction", 'The codebase is public so architectural decisions can be inspected and discussed.'], ["Fail-closed mindset", 'Missing production secrets or invalid sessions should result in controlled failures rather than implicit access.']].map(([title, body]) => <article key={title} className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 space-y-3"><CheckCircle2 className="w-6 h-6 text-[#14F195]" /><h2 className="text-lg font-bold text-white">{title}</h2><p className="text-sm text-slate-300 leading-7">{body}</p></article>)}</div>
  </Shell>
);

export const EnglishDownloadPage: React.FC<Props> = ({ onNavigate }) => (
  <Shell><Hero icon={<Download className="w-4 h-4" />} eyebrow="Android application" title={<>Download the Solmint Android application</>} body="The website is the public information layer; the Android application is the execution environment for the wallet experience. Keep your recovery material under your control and verify the source before installing." actions={<><a href="https://t.me/solmintchannel" target="_blank" rel="noreferrer" className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-black font-extrabold text-sm inline-flex items-center gap-2"><Download className="w-4 h-4" />Download / release channel</a><SecondaryButton onClick={() => onNavigate('/en/security')}><Lock className="w-4 h-4" />Read security guidance</SecondaryButton></>} />
  </Shell>
);

export const EnglishFaqPage: React.FC<Props> = () => (
  <Shell><Hero icon={<HelpCircle className="w-4 h-4" />} eyebrow="FAQ" title={<>Frequently asked questions about Solmint</>} body="Answers to the most common questions about the wallet, Solana tooling, security model and the English platform." />
    <div className="space-y-4 max-w-4xl mx-auto">{[["Is Solmint custodial?", 'The wallet direction is non-custodial: users control their signing keys locally.'], ["Does Solmint store private keys on the server?", 'The intended wallet architecture keeps sensitive signing material local to the device rather than in the website database.'], ["What is the English site?", 'It is the international surface of the same Solmint project, with localized routes, SEO and article relationships.'], ["Where can I learn more?", 'Use the English Blog & Academy for research, education and ecosystem coverage.']].map(([q, a]) => <details key={q} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"><summary className="cursor-pointer font-bold text-white">{q}</summary><p className="pt-3 text-sm leading-7 text-slate-300">{a}</p></details>)}</div>
  </Shell>
);

export const EnglishAppGuidePage: React.FC<Props> = ({ onNavigate }) => (
  <Shell><Hero icon={<Smartphone className="w-4 h-4" />} eyebrow="App guide" title={<>A practical guide to the Solmint Android experience</>} body="Move from the public website to the mobile application, create or recover a wallet locally, and use Solana features without turning the website into a custodian." actions={<PrimaryButton onClick={() => onNavigate('/en/download')}><Download className="w-4 h-4" />Download the app</PrimaryButton>} />
    <div className="grid md:grid-cols-3 gap-6">{['Install from a verified source', 'Create or restore locally', 'Review every transaction before signing'].map((title, i) => <article key={title} className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 space-y-3"><span className="text-[#14F195] font-black">0{i + 1}</span><h2 className="text-lg font-bold text-white">{title}</h2><p className="text-sm text-slate-300 leading-7">Follow the same security-first workflow every time.</p></article>)}</div>
  </Shell>
);

export const EnglishWalletAnalyzerPage: React.FC<Props> = () => (
  <Shell><Hero icon={<FileSearch className="w-4 h-4" />} eyebrow="Wallet analysis" title={<>Analyze a Solana wallet without exposing private keys</>} body="The analyzer is designed for public on-chain information. A wallet address is enough for the analysis workflow; private keys are never part of the request." />
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 max-w-3xl mx-auto space-y-4"><label className="text-sm font-bold text-white" htmlFor="english-wallet-address">Wallet address</label><input id="english-wallet-address" className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[#14F195]/50" placeholder="Paste a Solana public address" /><button type="button" className="px-5 py-3 rounded-xl bg-white/10 text-slate-200 font-bold inline-flex items-center gap-2"><FileSearch className="w-4 h-4" />Analyze public activity</button></div>
  </Shell>
);

export const EnglishToolsPage: React.FC<Props> = ({ onNavigate }) => (
  <Shell><Hero icon={<Wrench className="w-4 h-4" />} eyebrow="Solana tools" title={<>Production-oriented tools for Solana tokens and on-chain research</>} body="Use focused utilities for token inspection, token scanning and Token-2022 research without leaving the Solmint platform." />
    <div className="grid md:grid-cols-3 gap-6">{[['/en/tools/solana-token-tools', 'Solana Token Tools', 'Create and inspect token-related workflows.'], ['/en/tools/solana-token-scanner', 'Solana Token Scanner', 'Inspect a mint and review its observable properties.'], ['/en/tools/token-2022-inspector', 'Token-2022 Inspector', 'Understand extensions and Token-2022 behavior.']].map(([path, title, body]) => <button type="button" key={path} onClick={() => onNavigate(path)} className="text-left rounded-3xl border border-white/10 bg-slate-900/80 p-6 space-y-3 hover:border-[#14F195]/30"><Wrench className="w-6 h-6 text-[#14F195]" /><h2 className="text-lg font-bold text-white">{title}</h2><p className="text-sm text-slate-300 leading-7">{body}</p><span className="text-xs text-[#14F195] font-bold inline-flex items-center gap-1">Open tool <ArrowRight className="w-3.5 h-3.5" /></span></button>)}</div>
  </Shell>
);
