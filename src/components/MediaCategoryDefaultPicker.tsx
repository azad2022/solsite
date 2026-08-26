import React, { useEffect, useState } from 'react';
import { Check, RefreshCw, Save, X } from 'lucide-react';
import { MediaAsset } from '../types';
import { ArticleCategory, fetchArticleCategories } from './ArticleCategoryManager';

type Props = { asset: MediaAsset | null; onClose: () => void };

export const MediaCategoryDefaultPicker: React.FC<Props> = ({ asset, onClose }) => {
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ success?: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    fetchArticleCategories(false)
      .then(rows => {
        if (cancelled) return;
        setCategories(rows);
        setSelectedIds(rows.filter(row => row.default_media_asset_id === asset.id).map(row => row.id));
      })
      .catch(error => { if (!cancelled) setMessage({ success: false, text: error?.message || 'دریافت دسته‌بندی‌ها ناموفق بود.' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [asset]);

  if (!asset) return null;
  const toggle = (id: string) => setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const selected = new Set(selectedIds);
      const assignments = categories
        .filter(category => selected.has(category.id) !== (category.default_media_asset_id === asset.id))
        .map(category => ({ id: category.id, use: selected.has(category.id) }));

      if (!assignments.length) {
        setMessage({ success: true, text: 'تغییری برای ذخیره وجود نداشت.' });
        return;
      }

      const response = await fetch('/api/category-default-media', {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset.id, publicUrl: asset.publicUrl, assignments })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || `ذخیره تصویر پیش‌فرض ناموفق بود (${response.status}).`);

      setMessage({
        success: true,
        text: `تصویر ذخیره شد؛ ${data.categoriesUpdated || 0} دسته‌بندی تنظیم و ${data.articlesUpdated || 0} مقاله به‌روزرسانی شد. مقالات جدید این دسته‌ها نیز همین تصویر را می‌گیرند.`
      });
      window.setTimeout(onClose, 1200);
    } catch (error: any) {
      setMessage({ success: false, text: error?.message || 'ذخیره تصویر پیش‌فرض ناموفق بود.' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="media-default-picker-title" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-purple-500/30 bg-[#0b1020] shadow-2xl" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-5 border-b border-slate-800 bg-[#0b1020]/95 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl overflow-hidden border border-purple-500/30 bg-slate-950 shrink-0"><img src={asset.publicUrl} alt={asset.altText || asset.filename} className="w-full h-full object-cover" /></div>
            <div className="min-w-0"><h3 id="media-default-picker-title" className="text-white font-extrabold text-sm">انتخاب تصویر پیش‌فرض دسته‌بندی</h3><p className="text-[10px] text-slate-500 truncate mt-1">{asset.filename}</p></div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer" aria-label="بستن"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          {message && <div className={`p-3 rounded-xl border text-xs font-bold ${message.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>{message.text}</div>}
          <div className="flex items-center justify-between gap-3"><div><div className="text-white font-bold text-xs">دسته‌بندی‌های موردنظر را انتخاب کنید</div><div className="text-[10px] text-slate-500 mt-1">هر تصویر می‌تواند تصویر پیش‌فرض چند دسته‌بندی باشد.</div></div>{loading && <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />}</div>

          {!loading && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">{categories.map(category => {
            const checked = selectedIds.includes(category.id);
            return <button key={category.id} type="button" onClick={() => toggle(category.id)} className={`text-right p-3 rounded-xl border transition-all cursor-pointer ${checked ? 'bg-purple-500/10 border-purple-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`} aria-pressed={checked}>
              <div className="flex items-center gap-3"><span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${checked ? 'bg-purple-500 border-purple-400 text-white' : 'bg-slate-900 border-slate-600 text-transparent'}`}><Check className="w-3.5 h-3.5" /></span><span className="min-w-0"><span className="block text-xs font-bold text-white truncate">{category.name}</span><span className="block text-[9px] font-mono text-slate-500 truncate dir-ltr mt-0.5">{category.slug}</span></span></div>
            </button>;
          })}</div>}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-800"><span className="text-[10px] text-slate-500">{selectedIds.length} دسته‌بندی انتخاب شده</span><div className="flex gap-2"><button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold cursor-pointer">انصراف</button><button type="button" onClick={() => void save()} disabled={loading || saving} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer disabled:opacity-40">{saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}ذخیره تصویر پیش‌فرض</button></div></div>
        </div>
      </div>
    </div>
  );
};
