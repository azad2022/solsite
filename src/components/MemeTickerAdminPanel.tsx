import React, { useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Plus, RefreshCw, Save, Settings2, Trash2, X, Zap } from 'lucide-react';
import { fetchMemeTickerConfig, saveMemeTickerConfig, testMemeTickerConfig, MemeTickerConfig, MemeTickerItem } from '../utils/memeTickerService';

const DEFAULT_ITEMS: Omit<MemeTickerItem, 'priceUsd' | 'change24h' | 'fetchedAt'>[] = [
  { id: 'btc', source: 'binance', pair: 'BTCUSDT', mint: '', symbol: 'BTC', name: 'Bitcoin', logoUrl: '', enabled: true, order: 0 },
  { id: 'eth', source: 'binance', pair: 'ETHUSDT', mint: '', symbol: 'ETH', name: 'Ethereum', logoUrl: '', enabled: true, order: 1 },
  { id: 'sol', source: 'binance', pair: 'SOLUSDT', mint: '', symbol: 'SOL', name: 'Solana', logoUrl: '', enabled: true, order: 2 },
  { id: 'bnb', source: 'binance', pair: 'BNBUSDT', mint: '', symbol: 'BNB', name: 'BNB', logoUrl: '', enabled: true, order: 3 },
  { id: 'xrp', source: 'binance', pair: 'XRPUSDT', mint: '', symbol: 'XRP', name: 'XRP', logoUrl: '', enabled: true, order: 4 },
  { id: 'doge', source: 'binance', pair: 'DOGEUSDT', mint: '', symbol: 'DOGE', name: 'Dogecoin', logoUrl: '', enabled: true, order: 5 },
  { id: 'ada', source: 'binance', pair: 'ADAUSDT', mint: '', symbol: 'ADA', name: 'Cardano', logoUrl: '', enabled: true, order: 6 },
  { id: 'avax', source: 'binance', pair: 'AVAXUSDT', mint: '', symbol: 'AVAX', name: 'Avalanche', logoUrl: '', enabled: true, order: 7 },
  { id: 'link', source: 'binance', pair: 'LINKUSDT', mint: '', symbol: 'LINK', name: 'Chainlink', logoUrl: '', enabled: true, order: 8 },
  { id: 'sui', source: 'binance', pair: 'SUIUSDT', mint: '', symbol: 'SUI', name: 'Sui', logoUrl: '', enabled: true, order: 9 },
  { id: 'ton', source: 'binance', pair: 'TONUSDT', mint: '', symbol: 'TON', name: 'Toncoin', logoUrl: '', enabled: true, order: 10 },
  { id: 'bonk', source: 'jupiter', pair: '', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', symbol: 'BONK', name: 'Bonk', logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png', enabled: true, order: 11 },
  { id: 'wif', source: 'jupiter', pair: '', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', symbol: 'WIF', name: 'dogwifhat', logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm/logo.png', enabled: true, order: 12 },
  { id: 'popcat', source: 'jupiter', pair: '', mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', symbol: 'POPCAT', name: 'Popcat', logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr/logo.png', enabled: true, order: 13 },
  { id: 'pengu', source: 'jupiter', pair: '', mint: '27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4', symbol: 'PENGU', name: 'Pudgy Penguins', logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4/logo.png', enabled: true, order: 14 }
];

const EMPTY_CONFIG: MemeTickerConfig = {
  enabled: true,
  provider: 'binance+jupiter',
  endpoint: 'https://api.jup.ag/price/v3',
  refreshSeconds: 20,
  direction: 'ltr',
  speedSeconds: 32,
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
    fetchMemeTickerConfig(adminPasscode())
      .then(serverConfig => {
        setConfig({ ...EMPTY_CONFIG, ...serverConfig, items: serverConfig.items?.length ? serverConfig.items : DEFAULT_ITEMS });
        setLoadedKeyMask(serverConfig.apiKeyMasked || '');
      })
      .catch(error => setNotice({ ok: false, text: error instanceof Error ? error.message : 'دریافت تنظیمات ناموفق بود.' }))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const updateItem = (index: number, patch: Record<string, unknown>) => {
    setConfig(current => ({ ...current, items: current.items.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  };

  const addItem = () => {
    setConfig(current => ({ ...current, items: [...current.items, { id: `coin-${Date.now()}`, source: 'jupiter', pair: '', mint: '', symbol: '', name: '', logoUrl: '', enabled: true, order: current.items.length }] }));
  };

  const removeItem = (index: number) => setConfig(current => ({ ...current, items: current.items.filter((_, i) => i !== index).map((item, i) => ({ ...item, order: i })) }));

  const save = async () => {
    setSaving(true); setNotice(null);
    try {
      await saveMemeTickerConfig(adminPasscode(), config, apiKey || loadedKeyMask);
      setLoadedKeyMask(apiKey ? `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}` : loadedKeyMask);
      setApiKey('');
      setNotice({ ok: true, text: 'تنظیمات بازار با موفقیت ذخیره شد.' });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : 'ذخیره‌سازی ناموفق بود.' });
    } finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true); setNotice(null);
    try {
      const result = await testMemeTickerConfig(adminPasscode(), config, apiKey || loadedKeyMask);
      setNotice({ ok: result.success, text: result.success ? `اتصال موفق است؛ ${result.validItems} نرخ معتبر دریافت شد.` : (result.message || 'قیمت معتبری دریافت نشد.') });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : 'تست API ناموفق بود.' });
    } finally { setTesting(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md p-3 sm:p-6 flex items-center justify-center" dir="rtl">
      <div className="w-full max-w-6xl max-h-[94vh] overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b0b14] shadow-2xl flex flex-col">
        <header className="px-5 sm:px-7 py-5 border-b border-white/10 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><Settings2 className="w-5 h-5 text-[#14F195]" /><h2 className="text-lg font-black text-white">مدیریت بازار لحظه‌ای</h2></div>
            <p className="text-xs text-slate-400 mt-1">کنترل نوار بازار صفحه اصلی؛ پیش‌فرض فعال و قابل خاموش‌سازی فوری</p>
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 text-slate-300 flex items-center justify-center"><X className="w-5 h-5" /></button>
        </header>

        <div className="overflow-y-auto p-5 sm:p-7 space-y-6">
          {loading ? <div className="py-20 text-center text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />در حال دریافت تنظیمات...</div> : <>
            <section className="grid lg:grid-cols-3 gap-4">
              <label className="lg:col-span-2 p-4 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-between gap-4 cursor-pointer">
                <span><b className="text-sm text-white">نمایش در صفحه اصلی</b><span className="block text-xs text-slate-400 mt-1">در حالت روشن، ticker نمایش داده می‌شود؛ در حالت خاموش فوراً از سایت حذف می‌شود.</span></span>
                <input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} className="w-5 h-5 accent-[#14F195]" />
              </label>
              <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.03]"><span className="text-[11px] text-slate-500">Data Engine</span><div className="text-sm font-black text-white mt-1">Binance + Jupiter</div><div className="text-[10px] text-slate-500 mt-1">Public market data</div></div>
            </section>

            <section className="grid lg:grid-cols-3 gap-4">
              <label><span className="text-xs text-slate-400">Jupiter Endpoint</span><input value={config.endpoint} onChange={e => setConfig({ ...config, endpoint: e.target.value })} className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white font-mono" dir="ltr" /></label>
              <label><span className="text-xs text-slate-400">Jupiter API Key</span><input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={loadedKeyMask || 'در صورت نیاز وارد کنید'} className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white font-mono" dir="ltr" /></label>
              <label><span className="text-xs text-slate-400">Refresh (seconds)</span><input type="number" min={10} max={300} value={config.refreshSeconds} onChange={e => setConfig({ ...config, refreshSeconds: Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white" /></label>
              <label><span className="text-xs text-slate-400">Animation duration (seconds)</span><input type="number" min={8} max={120} value={config.speedSeconds} onChange={e => setConfig({ ...config, speedSeconds: Number(e.target.value) })} className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white" /></label>
              <div className="lg:col-span-2 p-3 rounded-xl bg-[#14F195]/5 border border-[#14F195]/15 text-xs text-slate-300 flex items-center gap-2"><Zap className="w-4 h-4 text-[#14F195]" /> کلید Jupiter در سرور نگهداری می‌شود و به بازدیدکننده عمومی ارسال نمی‌شود.</div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between"><div><h3 className="font-black text-white">دارایی‌های نمایش‌داده‌شده</h3><p className="text-xs text-slate-500 mt-1">Binance برای بازار اصلی و Jupiter برای توکن‌های Solana استفاده می‌شود.</p></div><button type="button" onClick={addItem} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white flex items-center gap-2"><Plus className="w-4 h-4" /> افزودن</button></div>
              {config.items.map((item, index) => (
                <div key={item.id} className="grid xl:grid-cols-[110px_140px_1fr_1fr_1fr_auto] gap-2 p-3 rounded-2xl border border-white/10 bg-white/[0.025]">
                  <select value={item.source || 'jupiter'} onChange={e => updateItem(index, { source: e.target.value, pair: e.target.value === 'binance' ? (item.pair || `${item.symbol || 'BTC'}USDT`) : '', mint: e.target.value === 'jupiter' ? item.mint : '' })} className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-xs text-white">
                    <option value="binance">Binance</option><option value="jupiter">Jupiter</option>
                  </select>
                  <input value={item.symbol} onChange={e => updateItem(index, { symbol: e.target.value.toUpperCase() })} placeholder="Symbol" className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-xs text-white" />
                  <input value={item.source === 'binance' ? (item.pair || '') : item.mint} onChange={e => updateItem(index, item.source === 'binance' ? { pair: e.target.value.toUpperCase() } : { mint: e.target.value.trim() })} placeholder={item.source === 'binance' ? 'BTCUSDT' : 'Solana Mint Address'} className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-[10px] text-white font-mono" dir="ltr" />
                  <input value={item.name} onChange={e => updateItem(index, { name: e.target.value })} placeholder="Name" className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-xs text-white" />
                  <input value={item.logoUrl || ''} onChange={e => updateItem(index, { logoUrl: e.target.value })} placeholder="Logo URL (optional)" className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-[10px] text-white" dir="ltr" />
                  <div className="flex items-center gap-1 justify-end"><button type="button" onClick={() => updateItem(index, { enabled: !item.enabled })} className={`w-9 h-9 rounded-xl flex items-center justify-center border ${item.enabled ? 'border-[#14F195]/30 text-[#14F195]' : 'border-white/10 text-slate-500'}`} aria-label="toggle asset">{item.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button><button type="button" onClick={() => removeItem(index)} className="w-9 h-9 rounded-xl border border-rose-500/20 text-rose-400 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button></div>
                </div>
              ))}
            </section>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-xs text-slate-400 leading-6">Kill Switch: با خاموش کردن «نمایش در صفحه اصلی»، public feed بلافاصله غیرفعال می‌شود. هیچ قیمت ساختگی یا آخرین مقدار ذخیره‌شده در زمان خرابی نمایش داده نمی‌شود.</div>

            {notice && <div className={`p-3 rounded-xl text-xs border ${notice.ok ? 'bg-[#14F195]/10 border-[#14F195]/20 text-[#14F195]' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>{notice.ok ? <CheckCircle2 className="w-4 h-4 inline ml-1" /> : null}{notice.text}</div>}
          </>}
        </div>

        <footer className="px-5 sm:px-7 py-4 border-t border-white/10 flex flex-wrap gap-2 justify-end">
          <button type="button" onClick={test} disabled={testing || loading} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-white flex items-center gap-2 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} /> تست منبع داده</button>
          <button type="button" onClick={save} disabled={saving || loading} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#14F195] to-[#9945FF] text-slate-950 text-xs font-black flex items-center gap-2 disabled:opacity-50"><Save className="w-4 h-4" /> {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}</button>
        </footer>
      </div>
    </div>
  );
};
