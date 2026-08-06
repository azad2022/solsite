import React, { useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Plus, RefreshCw, Save, Settings2, Trash2, X, Zap } from 'lucide-react';
import { fetchMemeTickerConfig, saveMemeTickerConfig, testMemeTickerConfig, MemeTickerConfig } from '../utils/memeTickerService';

const DEFAULT_ITEMS = [
  { id: 'bonk', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', name: 'Bonk', logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png', enabled: true, order: 0 },
  { id: 'wif', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF', name: 'dogwifhat', logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm/logo.png', enabled: true, order: 1 },
  { id: 'popcat', mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', symbol: 'POPCAT', name: 'Popcat', logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr/logo.png', enabled: true, order: 2 },
  { id: 'pengu', mint: '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4', symbol: 'PENGU', name: 'Pudgy Penguins', logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4/logo.png', enabled: true, order: 3 }
];

const EMPTY_CONFIG: MemeTickerConfig = {
  enabled: false,
  provider: 'jupiter',
  endpoint: 'https://api.jup.ag/price/v3',
  refreshSeconds: 20,
  direction: 'ltr',
  speedSeconds: 28,
  items: DEFAULT_ITEMS
};

export const MemeTickerAdminPanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<MemeTickerConfig>(EMPTY_CONFIG);
  const [apiKey, setApiKey] = useState('');
  const [loadedKeyMask, setLoadedKeyMask] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const adminPasscode = () => (localStorage.getItem('solmint_admin_passcode') || 'solmint1404').trim().replace(/^["']|["']$/g, '');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setNotice(null);
    fetchMemeTickerConfig(adminPasscode()).then((serverConfig) => {
      setConfig({ ...EMPTY_CONFIG, ...serverConfig, items: serverConfig.items?.length ? serverConfig.items : DEFAULT_ITEMS });
      setLoadedKeyMask(serverConfig.apiKeyMasked || '');
    }).catch((error) => setNotice({ ok: false, text: error instanceof Error ? error.message : 'دریافت تنظیمات ناموفق بود.' })).finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const updateItem = (index: number, patch: Record<string, unknown>) => {
    setConfig(current => ({ ...current, items: current.items.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  };

  const addItem = () => {
    setConfig(current => ({ ...current, items: [...current.items, { id: `coin-${Date.now()}`, mint: '', symbol: '', name: '', logoUrl: '', enabled: true, order: current.items.length }] }));
  };

  const removeItem = (index: number) => setConfig(current => ({ ...current, items: current.items.filter((_, i) => i !== index).map((item, i) => ({ ...item, order: i })) }));

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await saveMemeTickerConfig(adminPasscode(), config, apiKey || loadedKeyMask);
      setLoadedKeyMask(apiKey ? `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}` : loadedKeyMask);
      setApiKey('');
      setNotice({ ok: true, text: 'تنظیمات Market Ticker با موفقیت ذخیره شد.' });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : 'ذخیره‌سازی ناموفق بود.' });
    } finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    setNotice(null);
    try {
      const result = await testMemeTickerConfig(adminPasscode(), config, apiKey || loadedKeyMask);
      setNotice({ ok: result.success, text: result.success ? `اتصال موفق است؛ ${result.validItems} ارز قیمت معتبر دریافت کرد.` : (result.message || 'قیمت معتبری دریافت نشد.') });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : 'تست API ناموفق بود.' });
    } finally { setTesting(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md p-3 sm:p-6 flex items-center justify-center" dir="rtl">
      <div className="w-full max-w-5xl max-h-[94vh] overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b0b14] shadow-2xl flex flex-col">
        <header className="px-5 sm:px-7 py-5 border-b border-white/10 flex items-center justify-between gap-4">
          <div><div className="flex items-center gap-2"><Settings2 className="w-5 h-5 text-[#14F195]" /><h2 className="text-lg font-black text-white">مدیریت نرخ بازار</h2></div><p className="text-xs text-slate-400 mt-1">کنترل Market Ticker صفحه اصلی و اتصال امن به Jupiter Price API</p></div>
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 text-slate-300 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </header>

        <div className="overflow-y-auto p-5 sm:p-7 space-y-6">
          {loading ? <div className="py-20 text-center text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />در حال دریافت تنظیمات...</div> : <>
            <section className="grid md:grid-cols-3 gap-4">
              <label className="md:col-span-2 p-4 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-between gap-4 cursor-pointer"><span><b className="text-sm text-white">نمایش Ticker</b><span className="block text-xs text-slate-400 mt-1">خاموش کردن آن، کل نوار قیمت را از صفحه اصلی حذف می‌کند.</span></span><input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} className="w-5 h-5 accent-[#14F195]" /></label>
              <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03]"><span className="text-[11px] text-slate-500">Provider</span><div className="text-sm font-black text-white mt-1">Jupiter Price API v3</div></div>
            </section>

            <section className="grid md:grid-cols-3 gap-4">
              <label className="md:col-span-2"><span className="text-xs text-slate-400">API Endpoint</span><input value={config.endpoint} onChange={e => setConfig({ ...config, endpoint: e.target.value })} className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white font-mono" /></label>
              <label><span className="text-xs text-slate-400">API Key</span><input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={loadedKeyMask || 'کلید جدید را وارد کنید'} className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white font-mono" /></label>
              <label><span className="text-xs text-slate-400">Refresh (seconds)</span><input type="number" min={10} max={300} value={config.refreshSeconds} onChange={e => setConfig({ ...config, refreshSeconds: Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white" /></label>
              <label><span className="text-xs text-slate-400">Animation duration (seconds)</span><input type="number" min={8} max={120} value={config.speedSeconds} onChange={e => setConfig({ ...config, speedSeconds: Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white" /></label>
              <div className="p-3 rounded-xl bg-[#14F195]/5 border border-[#14F195]/15 text-xs text-slate-300 flex items-center gap-2"><Zap className="w-4 h-4 text-[#14F195]" /> API Key فقط در Supabase ذخیره می‌شود و به مرورگر عمومی ارسال نمی‌شود.</div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between"><div><h3 className="font-black text-white">ارزهای نمایش‌داده‌شده</h3><p className="text-xs text-slate-500 mt-1">Mint Address را دقیقاً از شبکه Solana وارد کنید.</p></div><button type="button" onClick={addItem} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white flex items-center gap-2"><Plus className="w-4 h-4" /> افزودن ارز</button></div>
              {config.items.map((item, index) => (
                <div key={item.id} className="grid lg:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 p-3 rounded-2xl border border-white/10 bg-white/[0.025]">
                  <input value={item.symbol} onChange={e => updateItem(index, { symbol: e.target.value.toUpperCase() })} placeholder="Symbol" className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-xs text-white" />
                  <input value={item.name} onChange={e => updateItem(index, { name: e.target.value })} placeholder="Name" className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-xs text-white" />
                  <input value={item.mint} onChange={e => updateItem(index, { mint: e.target.value.trim() })} placeholder="Solana Mint Address" className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-[10px] text-white font-mono" dir="ltr" />
                  <input value={item.logoUrl || ''} onChange={e => updateItem(index, { logoUrl: e.target.value })} placeholder="Logo URL (optional)" className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-[10px] text-white" dir="ltr" />
                  <div className="flex items-center gap-1 justify-end"><button type="button" onClick={() => updateItem(index, { enabled: !item.enabled })} className={`w-9 h-9 rounded-xl flex items-center justify-center border ${item.enabled ? 'border-[#14F195]/30 text-[#14F195]' : 'border-white/10 text-slate-500'}`} aria-label="toggle coin">{item.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button><button type="button" onClick={() => removeItem(index)} className="w-9 h-9 rounded-xl border border-rose-500/20 text-rose-400 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button></div>
                </div>
              ))}
            </section>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-slate-400 leading-6">رفتار نمایش: حرکت افقی از چپ به راست، توقف با Hover یا لمس/کلیک، پشتیبانی از کاهش حرکت سیستم، و عدم نمایش داده جعلی هنگام قطع API. قیمت‌ها از API دریافت می‌شوند و در صورت خطا، کارت‌ها به قیمت ساختگی برنمی‌گردند.</div>

            {notice && <div className={`p-3 rounded-xl text-xs border ${notice.ok ? 'bg-[#14F195]/10 border-[#14F195]/20 text-[#14F195]' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>{notice.ok ? <CheckCircle2 className="w-4 h-4 inline ml-1" /> : null}{notice.text}</div>}
          </>}
        </div>

        <footer className="px-5 sm:px-7 py-4 border-t border-white/10 flex flex-wrap gap-2 justify-end">
          <button type="button" onClick={test} disabled={testing || loading} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-white flex items-center gap-2 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} /> تست API</button>
          <button type="button" onClick={save} disabled={saving || loading} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#14F195] to-[#9945FF] text-slate-950 text-xs font-black flex items-center gap-2 disabled:opacity-50"><Save className="w-4 h-4" /> {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}</button>
        </footer>
      </div>
    </div>
  );
};
