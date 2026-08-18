import React from 'react';
import { Download, Lock, Smartphone } from 'lucide-react';

type Props = {
  onNavigate: (path: string) => void;
  downloadLinks?: {
    apkUrl?: string;
    telegramUrl?: string;
    googlePlayUrl?: string;
    webAppUrl?: string;
    apkVersion?: string;
    downloadNotice?: string;
  };
};

export const EnglishDownloadPage: React.FC<Props> = ({ onNavigate, downloadLinks }) => {
  const apkUrl = downloadLinks?.apkUrl?.trim();
  const telegramUrl = downloadLinks?.telegramUrl?.trim();
  const googlePlayUrl = downloadLinks?.googlePlayUrl?.trim();
  const webAppUrl = downloadLinks?.webAppUrl?.trim();

  return (
    <main dir="ltr" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12">
      <section className="text-center max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#9945FF]/10 border border-[#9945FF]/30 text-[#14F195] text-xs font-bold"><Smartphone className="w-4 h-4" />Android application</div>
        <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">Download the Solmint Android application</h1>
        <p className="text-slate-300 text-sm sm:text-base leading-8 max-w-3xl mx-auto">The website is the public information layer; the Android application is the execution environment for the wallet experience. Keep your recovery material under your control and verify the source before installing.</p>
        {downloadLinks?.downloadNotice && <p className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm leading-7 text-amber-200">{downloadLinks.downloadNotice}</p>}
        {downloadLinks?.apkVersion && <p className="text-xs font-bold text-slate-500">Current Android version: {downloadLinks.apkVersion}</p>}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          apkUrl ? { href: apkUrl, label: 'Download APK' } : null,
          telegramUrl ? { href: telegramUrl, label: 'Official release channel' } : null,
          googlePlayUrl ? { href: googlePlayUrl, label: 'Google Play' } : null,
          webAppUrl ? { href: webAppUrl, label: 'Web app' } : null
        ].filter(Boolean).map((item) => item ? (
          <a key={item.href} href={item.href} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 bg-slate-900/80 px-5 py-4 text-sm font-black text-white hover:border-[#14F195]/30 hover:bg-white/5 transition-all inline-flex items-center justify-center gap-2">
            <Download className="w-4 h-4 text-[#14F195]" />{item.label}
          </a>
        ) : null)}
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 space-y-3"><h2 className="text-xl font-black text-white">Verify the source</h2><p className="text-sm leading-7 text-slate-300">Use only release links published through Solmint's configured channels. Never enter a seed phrase or private key into a website to download an application.</p></article>
        <article className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 space-y-3"><h2 className="text-xl font-black text-white flex items-center gap-2"><Lock className="w-5 h-5 text-[#14F195]" />Read the security model</h2><p className="text-sm leading-7 text-slate-300">Review how Solmint separates the public web layer from local wallet signing.</p><button type="button" onClick={() => onNavigate('/en/security')} className="rounded-xl bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10">Open security page</button></article>
      </section>
    </main>
  );
};
