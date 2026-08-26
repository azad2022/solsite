import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Image as ImageIcon, RefreshCw, Save } from 'lucide-react';
import { MediaAsset } from '../types';
import { getAllMediaAssets } from '../utils/mediaService';
import { ArticleCategory, fetchArticleCategories, updateArticleCategory } from './ArticleCategoryManager';

type ImageAsset = Pick<MediaAsset, 'id' | 'filename' | 'publicUrl' | 'path' | 'altText' | 'title' | 'mimeType'>;

const isImageAsset = (asset: MediaAsset) =>
  /^image\//i.test(asset.mimeType || '') || /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(asset.filename || '');

export const MediaLibraryCoverAssignment: React.FC = () => {
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ success?: boolean; message: string } | null>(null);

  const selectedAsset = useMemo(
    () => assets.find(asset => asset.id === selectedAssetId) || null,
    [assets, selectedAssetId]
  );

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('fa-IR');
    if (!q) return assets;
    return assets.filter(asset =>
      `${asset.filename} ${asset.title || ''} ${asset.altText || ''}`.toLocaleLowerCase('fa-IR').includes(q)
    );
  }, [assets, search]);

  const load = async (keepSelection = true) => {
    setLoading(true);
    setNotice(null);
    try {
      const [media, categoryRows] = await Promise.all([
        getAllMediaAssets(),
        fetchArticleCategories(true),
      ]);
      const imageAssets = (media || []).filter(isImageAsset) as ImageAsset[];
      setAssets(imageAssets);
      setCategories(categoryRows);
      if (!keepSelection) {
        setSelectedAssetId('');
        setSelectedCategoryIds([]);
      }
    } catch (error: any) {
      setNotice({ success: false, message: error?.message || 'دریافت کتابخانه تصاویر یا دسته‌بندی‌ها ناموفق بود.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(false);
  }, []);

  useEffect(() => {
    if (!selectedAsset) {
      setSelectedCategoryIds([]);
      return;
    }
    setSelectedCategoryIds(
      categories
        .filter(category => category.default_media_asset_id === selectedAsset.id)
        .map(category => category.id)
    );
  }, [selectedAsset, categories]);

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds(current =>
      current.includes(id) ? current.filter(categoryId => categoryId !== id) : [...current, id]
    );
  };

  const saveAssignment = async () => {
    if (!selectedAsset || !selectedCategoryIds.length) return;
    setSaving(true);
    setNotice(null);
    try {
      const selectedIds = new Set(selectedCategoryIds);
      const targetCategories = categories.filter(category => selectedIds.has(category.id));
      const updated = await Promise.all(
        targetCategories.map(category =>
          updateArticleCategory(category.id, {
            default_media_asset_id: selectedAsset.id,
            default_media_url: selectedAsset.publicUrl,
          })
        )
      );

      setCategories(current => current.map(category => {
        const replacement = updated.find(item => item.id === category.id);
        return replacement || category;
      }));
      setNotice({
        success: true,
        message: `تصویر «${selectedAsset.filename}» برای ${updated.length} دسته‌بندی به‌عنوان تصویر پیش‌فرض ذخیره شد.`,
      });
    } catch (error: any) {
      setNotice({ success: false, message: error?.message || 'ذخیره تصویر پیش‌فرض دسته‌بندی‌ها ناموفق بود.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5" data-production-cover-assignment="true" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-purple-400" />
            تصویر پیش‌فرض دسته‌بندی‌ها
          </h4>
          <p className="text-[11px] text-slate-400 mt-1 leading-5">
            روی یک تصویر کلیک کنید، سپس یک یا چند دسته‌بندی را انتخاب کنید تا همان تصویر به‌عنوان تصویر پیش‌فرض آنها ذخیره شود.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || saving}
          className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          بروزرسانی
        </button>
      </div>

      {notice && (
        <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold ${notice.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
          {notice.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{notice.message}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="جستجو در نام یا عنوان تصویر..."
          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-xs outline-none focus:border-purple-500/50"
        />
        <span className="text-[11px] text-slate-500 whitespace-nowrap">{filteredAssets.length} تصویر</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-h-[560px] overflow-y-auto pr-1">
        {filteredAssets.map(asset => {
          const isSelected = asset.id === selectedAssetId;
          const assignedCount = categories.filter(category => category.default_media_asset_id === asset.id).length;
          return (
            <button
              key={asset.id}
              type="button"
              onClick={() => setSelectedAssetId(asset.id)}
              className={`group relative overflow-hidden rounded-2xl border text-right transition-all cursor-pointer ${isSelected ? 'border-purple-400 ring-2 ring-purple-500/30 bg-purple-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}
              aria-pressed={isSelected}
              title={asset.title || asset.altText || asset.filename}
            >
              <div className="aspect-[4/3] bg-slate-950 overflow-hidden">
                <img src={asset.publicUrl} alt={asset.altText || asset.title || asset.filename} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
              </div>
              <div className="p-2.5 space-y-1">
                <div className="text-[10px] font-bold text-slate-200 truncate">{asset.title || asset.filename}</div>
                <div className="text-[9px] text-slate-500 truncate dir-ltr">{asset.filename}</div>
                {assignedCount > 0 && <div className="text-[9px] text-emerald-400 font-bold">پیش‌فرض {assignedCount} دسته</div>}
              </div>
              {isSelected && (
                <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-lg">
                  <Check className="w-4 h-4" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!filteredAssets.length && !loading && (
        <div className="p-6 rounded-2xl border border-dashed border-slate-700 text-center text-slate-500 text-xs">
          تصویری در کتابخانه پیدا نشد.
        </div>
      )}

      {selectedAsset && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            <img src={selectedAsset.publicUrl} alt={selectedAsset.altText || selectedAsset.filename} className="w-24 h-20 rounded-xl object-cover border border-slate-700" />
            <div className="min-w-0 flex-1">
              <div className="text-white font-extrabold text-sm truncate">{selectedAsset.title || selectedAsset.filename}</div>
              <div className="text-[10px] text-slate-500 font-mono truncate dir-ltr mt-1">{selectedAsset.path}</div>
              <div className="text-[11px] text-purple-300 mt-2">حالا دسته‌بندی‌هایی را که باید این تصویر را به‌عنوان تصویر پیش‌فرض داشته باشند انتخاب کنید.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {categories.map(category => {
              const checked = selectedCategoryIds.includes(category.id);
              return (
                <label key={category.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? 'border-purple-500/40 bg-purple-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-700'}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleCategory(category.id)} className="sr-only" />
                  <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${checked ? 'bg-purple-500 border-purple-400 text-white' : 'border-slate-600 bg-slate-950'}`}>
                    {checked && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-white truncate">{category.name}</span>
                    <span className="block text-[9px] text-slate-500 font-mono truncate dir-ltr">{category.slug}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <span className="text-[11px] text-slate-500">{selectedCategoryIds.length} دسته‌بندی انتخاب شده</span>
            <button
              type="button"
              disabled={!selectedCategoryIds.length || saving}
              onClick={() => void saveAssignment()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              ذخیره تصویر پیش‌فرض برای دسته‌های انتخاب‌شده
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
