import React, { useEffect, useMemo, useState } from 'react';
import { Check, Image as ImageIcon, Play, RefreshCw, Save, Shuffle, X } from 'lucide-react';
import { MediaAsset } from '../types';

type Category = { id: string; name: string; slug: string; default_media_asset_id?: string | null; default_media_url?: string | null; default_media_mode?: 'single' | 'random' | 'slideshow'; default_media_interval_ms?: number; media_assets?: MediaAsset[] };
type Props = { asset: MediaAsset | null; onClose: () => void };
type Mode = 'single' | 'random' | 'slideshow';

const MODES: Array<{ value: Mode; label: string; Icon: typeof ImageIcon }> = [
  { value: 'single', label: 'ثابت', Icon: ImageIcon },
  { value: 'random', label: 'تصادفی', Icon: Shuffle },
  { value: 'slideshow', label: 'اسلایدشو', Icon: Play },
];

export const MediaCategoryDefaultPicker: React.FC<Props> = ({ asset, onClose }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>('single');
  const [intervalMs, setIntervalMs] = useState(4500);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ success?: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    fetch('/api/category-default-media-gallery', { cache: 'no-store' })
      .then(async response => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) throw new Error(payload?.message || `دریافت تنظیمات تصاویر ناموفق بود (${response.status}).`);
        return payload;
      })
      .then(payload => {
        if (cancelled) return;
        const rows = Array.isArray(payload.categories) ? payload.categories as Category[] : [];
        setCategories(rows);
        const match = rows.find(category => category.media_assets?.some(media => media.id === asset.id)) || rows[0] || null;
        setSelectedCategoryId(match?.id || null);
        setSelectedIds((match?.media_assets || []).map(media => media.id));
        setMode(match?.default_media_mode || 'single');
        setIntervalMs(Number(match?.default_media_interval_ms) || 4500);
      })
      .catch(error => { if (!cancelled) setMessage({ success: false, text: error?.message || 'دریافت تنظیمات تصاویر ناموفق بود.' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [asset]);

  const currentCategory = useMemo(() => categories.find(category => category.id === selectedCategoryId) || null, [categories, selectedCategoryId]);
  const uniqueAssets = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    categories.forEach(category => (category.media_assets || []).forEach(media => map.set(media.id, media)));
    if (asset) map.set(asset.id, asset);
    return Array.from(map.values());
  }, [asset, categories]);
  const previewAssets = selectedIds.map(id => uniqueAssets.find(media => media.id === id)).filter(Boolean) as MediaAsset[];

  const selectCategory = (category: Category) => {
    setSelectedCategoryId(category.id);
    setSelectedIds((category.media_assets || []).map(media => media.id));
    setMode(category.default_media_mode || 'single');
    setIntervalMs(Number(category.default_media_interval_ms) || 4500);
    setMessage(null);
  };

  const toggleAsset = (id: string) => setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  const save = async () => {
    if (!selectedCategoryId) return;
    if (!selectedIds.length) return setMessage({ success: false, text: 'حداقل یک تصویر برای دسته‌بندی انتخاب کنید.' });
    if (mode === 'single' && selectedIds.length !== 1) return setMessage({ success: false, text: 'در حالت ثابت باید دقیقاً یک تصویر انتخاب شود.' });
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/category-default-media-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: selectedCategoryId, mediaAssetIds: selectedIds, mode, intervalMs }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.message || `ذخیره تنظیمات ناموفق بود (${response.status}).`);
      setCategories(current => current.map(category => category.id === selectedCategoryId ? { ...category, ...payload.category, media_assets: previewAssets } : category));
      setMessage({ success: true, text: `${selectedIds.length} تصویر برای «${currentCategory?.name || 'دسته‌بندی'}» ذخیره شد؛ ${Number(payload.articles_updated || 0)} مقاله با تصویر اصلی مجموعه همگام شد.` });
    } catch (error: any) {
      setMessage({ success: false, text: error?.message || 'ذخیره تنظیمات تصویر ناموفق بود.' });
    } finally { setSaving(false); }
  };

  if (!asset) return null;

  return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="media-default-picker-title" onClick={onClose}>
    <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl border border-purple-500/30 bg-[#0b1020] shadow-2xl" onClick={event => event.stopPropagation()} dir="rtl">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 p-5 border-b border-slate-800 bg-[#0b1020]/95 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0"><div className="max-w-24 max-h-14 rounded-xl overflow-hidden border border-purple-500/30 bg-slate-950 shrink-0 flex items-center justify-center p-1"><img src={asset.publicUrl} alt={asset.altText || asset.filename} className="max-w-full max-h-12 w-auto h-auto object-contain" /></div><div className="min-w-0"><h3 id="media-default-picker-title" className="text-white font-extrabold text-sm">مجموعه تصاویر پیش‌فرض دسته‌بندی</h3><p className="text-[10px] text-slate-500 truncate mt-1">برای «{currentCategory?.name || 'انتخاب دسته‌بندی'}» یک یا چند تصویر انتخاب کنید.</p></div></div>
        <button type="button" onClick={onClose} className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer" aria-label="بستن"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5">
        <aside className="space-y-3"><div className="text-white font-bold text-xs flex items-center gap-2"><ImageIcon className="w-4 h-4 text-purple-400" />دسته‌بندی‌ها</div><div className="space-y-2 max-h-[34rem] overflow-y-auto pr-1">{!loading && categories.map(category => <button key={category.id} type="button" onClick={() => selectCategory(category)} className={`w-full text-right p-3 rounded-xl border transition-all cursor-pointer ${category.id === selectedCategoryId ? 'bg-purple-500/10 border-purple-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-white truncate">{category.name}</span><span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-900 text-slate-500">{category.media_assets?.length || 0}</span></div></button>)}</div></aside>

        <main className="space-y-5 min-w-0">
          {message && <div className={`p-3 rounded-xl border text-xs font-bold ${message.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>{message.text}</div>}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-4"><div className="flex items-center justify-between gap-3"><div><div className="text-white font-bold text-xs">تصاویر کتابخانه</div><div className="text-[10px] text-slate-500 mt-1">با انتخاب چند تصویر می‌توانید آن‌ها را به‌عنوان مجموعه پیش‌فرض همین دسته ذخیره کنید.</div></div>{loading && <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />}</div><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{uniqueAssets.map(media => { const checked = selectedIds.includes(media.id); const width = Number((media as any).width) || 16; const height = Number((media as any).height) || 9; return <button key={media.id} type="button" onClick={() => toggleAsset(media.id)} className={`relative overflow-hidden rounded-2xl border bg-slate-950 transition-all cursor-pointer ${checked ? 'border-purple-400 ring-2 ring-purple-500/30' : 'border-slate-800 hover:border-slate-600'}`} style={{ aspectRatio: `${width}/${height}` }} aria-pressed={checked} title={media.filename}><img src={media.publicUrl} alt={media.altText || media.filename} loading="lazy" className="absolute inset-0 w-full h-full object-contain" /><span className={`absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center border shadow-lg ${checked ? 'bg-purple-500 border-purple-300 text-white' : 'bg-black/60 border-white/20 text-transparent'}`}><Check className="w-4 h-4" /></span></button>; })}</div></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3"><div className="text-white font-bold text-xs">نحوه نمایش در مقاله</div><div className="grid grid-cols-3 gap-2">{MODES.map(({ value, label, Icon }) => <button key={value} type="button" onClick={() => setMode(value)} className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-2 cursor-pointer ${mode === value ? 'bg-purple-500/10 border-purple-500/50 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}><Icon className="w-4 h-4" />{label}</button>)}</div><p className="text-[10px] text-slate-500 leading-5">تصادفی: در هر بار بارگذاری یکی از تصاویر. اسلایدشو: نمایش خودکار تصاویر به‌ترتیب.</p>{mode === 'single' && selectedIds.length !== 1 && <p className="text-[10px] text-amber-300">در حالت ثابت دقیقاً یک تصویر انتخاب کنید.</p>}{mode === 'slideshow' && <label className="block text-[10px] text-slate-400">فاصله اسلاید<div className="mt-2 flex items-center gap-2"><input type="range" min="1500" max="20000" step="500" value={intervalMs} onChange={event => setIntervalMs(Number(event.target.value))} className="flex-1" /><span className="w-16 text-center text-white bg-slate-900 border border-slate-800 rounded-lg py-1">{(intervalMs / 1000).toFixed(1)}s</span></div></label>}</div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"><div className="text-white font-bold text-xs mb-3">پیش‌نمایش بدون برش</div>{previewAssets.length ? <div className="space-y-3"><div className="w-full max-h-[24rem] rounded-2xl border border-slate-800 bg-black/30 overflow-hidden flex items-center justify-center p-2"><img src={previewAssets[0].publicUrl} alt={previewAssets[0].altText || previewAssets[0].filename} className="max-w-full max-h-[23rem] w-auto h-auto object-contain" /></div><div className="flex flex-wrap gap-1.5">{previewAssets.map((media, index) => <span key={media.id} className="text-[9px] px-2 py-1 rounded-lg bg-slate-900 text-slate-400 border border-slate-800">{index + 1}. {media.filename}</span>)}</div></div> : <div className="h-48 rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-slate-600 text-xs">تصویری انتخاب نشده است.</div>}</div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-800"><span className="text-[10px] text-slate-500">{selectedIds.length} تصویر انتخاب شده</span><div className="flex gap-2"><button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold cursor-pointer">انصراف</button><button type="button" onClick={() => void save()} disabled={loading || saving || !selectedCategoryId || !selectedIds.length || (mode === 'single' && selectedIds.length !== 1)} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer disabled:opacity-40">{saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}ذخیره تنظیمات</button></div></div>
        </main>
      </div>
    </div>
  );
};
