import React, { useEffect, useMemo, useState } from 'react';
import { Check, Eye, EyeOff, GripVertical, ImagePlus, RefreshCw, Smartphone, Trash2, X } from 'lucide-react';
import { fetchCmsSettingsFromApi, saveCmsSettingsToApi } from '../utils/cmsApiClient';
import { getAllMediaAssets, uploadMediaAsset } from '../utils/mediaService';
import { MediaAsset } from '../types';

export interface AppShowcaseSlide {
  id: string;
  title: string;
  description: string;
  assetId: string;
  imageUrl: string;
  altText: string;
  order: number;
  enabled: boolean;
}

export interface AppShowcaseConfig {
  enabled: boolean;
  model: string;
  screenWidth: number;
  screenHeight: number;
  autoplayMs: number;
  slides: AppShowcaseSlide[];
}

const DEFAULT_CONFIG: AppShowcaseConfig = {
  enabled: false,
  model: 'Samsung Galaxy S26 Ultra',
  screenWidth: 1440,
  screenHeight: 3120,
  autoplayMs: 5000,
  slides: []
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AppShowcaseAdminPanel: React.FC<Props> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<AppShowcaseConfig>(DEFAULT_CONFIG);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [altText, setAltText] = useState('');

  const load = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const [settings, media] = await Promise.all([fetchCmsSettingsFromApi(), getAllMediaAssets()]);
      const showcase = (settings as any)?.appShowcase;
      setConfig({ ...DEFAULT_CONFIG, ...(showcase || {}), slides: Array.isArray(showcase?.slides) ? showcase.slides : [] });
      setAssets(Array.isArray(media) ? media : []);
    } catch (error: any) {
      setNotice({ ok: false, text: error?.message || 'بارگذاری تنظیمات Showcase ناموفق بود.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen]);

  const sortedSlides = useMemo(() => [...config.slides].sort((a, b) => a.order - b.order), [config.slides]);

  const save = async (nextConfig: AppShowcaseConfig = config) => {
    setSaving(true);
    setNotice(null);
    try {
      const ok = await saveCmsSettingsToApi({ appShowcase: nextConfig } as any);
      if (!ok) throw new Error('ذخیره تنظیمات Showcase در سرور ناموفق بود.');
      setConfig(nextConfig);
      setNotice({ ok: true, text: 'تنظیمات نمایش اپلیکیشن با موفقیت ذخیره شد.' });
    } catch (error: any) {
      setNotice({ ok: false, text: error?.message || 'ذخیره تنظیمات ناموفق بود.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = () => void save({ ...config, enabled: !config.enabled });

  const addSelectedAsset = () => {
    const asset = assets.find(item => item.id === selectedAssetId);
    if (!asset) return;
    const exists = config.slides.some(slide => slide.assetId === asset.id);
    if (exists) {
      setNotice({ ok: false, text: 'این تصویر قبلاً به Showcase اضافه شده است.' });
      return;
    }
    if (asset.width !== 1440 || asset.height !== 3120) {
      setNotice({ ok: false, text: `ابعاد تصویر باید دقیقاً 1440×3120 باشد. تصویر انتخاب‌شده ${asset.width || '?'}×${asset.height || '?'} است.` });
      return;
    }
    const next: AppShowcaseSlide = {
      id: `showcase-${Date.now()}`,
      assetId: asset.id,
      imageUrl: asset.publicUrl,
      title: title.trim() || asset.title || asset.originalFilename,
      description: description.trim(),
      altText: altText.trim() || asset.altText || asset.title || asset.originalFilename,
      order: config.slides.length,
      enabled: true
    };
    setConfig(prev => ({ ...prev, slides: [...prev.slides, next] }));
    setSelectedAssetId('');
    setTitle('');
    setDescription('');
    setAltText('');
  };

  const removeSlide = (id: string) => {
    const slides = config.slides.filter(slide => slide.id !== id).map((slide, index) => ({ ...slide, order: index }));
    void save({ ...config, slides });
  };

  const toggleSlide = (id: string) => {
    const slides = config.slides.map(slide => slide.id === id ? { ...slide, enabled: !slide.enabled } : slide);
    void save({ ...config, slides });
  };

  const moveSlide = (id: string, direction: -1 | 1) => {
    const slides = [...sortedSlides];
    const index = slides.findIndex(slide => slide.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= slides.length) return;
    [slides[index], slides[target]] = [slides[target], slides[index]];
    const normalized = slides.map((slide, order) => ({ ...slide, order }));
    setConfig(prev => ({ ...prev, slides: normalized }));
  };

  const handleUpload = async (file: File) => {
    if (file.type !== 'image/png' && file.type !== 'image/jpeg' && file.type !== 'image/webp') {
      setNotice({ ok: false, text: 'فقط PNG، JPEG یا WebP قابل قبول است.' });
      return;
    }
    const bitmap = await createImageBitmap(file);
    const validSize = bitmap.width === 1440 && bitmap.height === 3120;
    bitmap.close();
    if (!validSize) {
      setNotice({ ok: false, text: `Screenshot باید دقیقاً 1440×3120 پیکسل باشد. ابعاد فایل: ${file.size ? 'نامشخص تا زمان پردازش' : 'نامشخص'}.` });
      return;
    }
    setUploading(true);
    setNotice(null);
    try {
      const result = await uploadMediaAsset(file, file.name, altText.trim(), title.trim());
      if (!result.success || !result.asset) throw new Error(result.message);
      setAssets(prev => [result.asset!, ...prev.filter(asset => asset.id !== result.asset!.id)]);
      setSelectedAssetId(result.asset.id);
      setNotice({ ok: true, text: 'Screenshot آپلود شد. اکنون آن را به Showcase اضافه کنید.' });
    } catch (error: any) {
      setNotice({ ok: false, text: error?.message || 'آپلود Screenshot ناموفق بود.' });
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3" dir="rtl">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-950 border border-[#9945FF]/40 shadow-2xl shadow-black/60 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-[#9945FF]/15 border border-[#9945FF]/30 text-[#14F195]"><Smartphone className="w-6 h-6" /></div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white">مدیریت نمایش اپلیکیشن</h2>
              <p className="text-xs text-slate-400 mt-1">مدیریت Screenshotهای نسخه انگلیسی اپلیکیشن در قاب موبایل صفحه اصلی</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white" aria-label="بستن"><X className="w-5 h-5" /></button>
        </div>

        {notice && <div className={`mb-4 p-3 rounded-xl text-xs font-bold border ${notice.ok ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'}`}>{notice.text}</div>}

        <div className="grid lg:grid-cols-[1fr_1.35fr] gap-5">
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div><h3 className="font-bold text-white text-sm">وضعیت نمایش در سایت</h3><p className="text-[11px] text-slate-400 mt-1">با خاموش کردن، کل بخش Showcase از صفحه اصلی حذف می‌شود.</p></div>
                <button onClick={toggleEnabled} disabled={saving} className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-2 ${config.enabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                  {config.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}{config.enabled ? 'فعال' : 'خاموش'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><span className="text-slate-500 block mb-1">دستگاه</span><strong className="text-white">{config.model}</strong></div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><span className="text-slate-500 block mb-1">Screenshot</span><strong className="text-[#14F195] font-mono">1440 × 3120</strong></div>
              </div>
              <div><label className="block text-xs font-semibold text-slate-300 mb-1">فاصله تغییر خودکار (ms)</label><input type="number" min={1500} step={500} value={config.autoplayMs} onChange={e => setConfig(prev => ({ ...prev, autoplayMs: Math.max(1500, Number(e.target.value) || 5000) }))} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono dir-ltr" /><p className="text-[10px] text-slate-500 mt-1">حداقل ۱۵۰۰ میلی‌ثانیه.</p></div>
              <button onClick={() => void save()} disabled={saving} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-slate-950 font-black text-xs disabled:opacity-50">{saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات Showcase'}</button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div><h3 className="font-bold text-white text-sm">افزودن Screenshot</h3><p className="text-[11px] text-slate-400 mt-1">استاندارد نسخه انگلیسی: PNG/JPEG/WebP با ابعاد دقیق 1440×3120.</p></div>
              <label className="w-full py-3 rounded-xl border border-dashed border-[#9945FF]/50 bg-[#9945FF]/5 text-[#14F195] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer">
                <ImagePlus className="w-4 h-4" />{uploading ? 'در حال آپلود...' : 'آپلود Screenshot جدید'}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) void handleUpload(file); e.currentTarget.value = ''; }} />
              </label>
              <select value={selectedAssetId} onChange={e => setSelectedAssetId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs">
                <option value="">انتخاب تصویر از Media Library</option>
                {assets.filter(asset => asset.width === 1440 && asset.height === 3120).map(asset => <option key={asset.id} value={asset.id}>{asset.title || asset.originalFilename}</option>)}
              </select>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان صفحه، مثلاً Wallet" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs" />
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="توضیح کوتاه برای نمایش زیر موبایل" rows={2} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs resize-none" />
              <input value={altText} onChange={e => setAltText(e.target.value)} placeholder="Alt text انگلیسی برای Screenshot" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs dir-ltr" />
              <button onClick={addSelectedAsset} disabled={!selectedAssetId || loading} className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 disabled:opacity-40">افزودن به Showcase</button>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between gap-3 mb-4"><div><h3 className="font-bold text-white text-sm">Screens فعال</h3><p className="text-[11px] text-slate-500 mt-1">ترتیب نمایش را با فلش‌ها کنترل کنید.</p></div><button onClick={() => void load()} disabled={loading} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
            {sortedSlides.length === 0 ? <div className="py-14 text-center text-slate-500 text-xs">هنوز Screenshotی برای Showcase انتخاب نشده است.</div> : <div className="space-y-3">{sortedSlides.map((slide, index) => <div key={slide.id} className={`p-3 rounded-2xl border ${slide.enabled ? 'border-slate-700 bg-slate-950' : 'border-slate-800 bg-slate-950/50 opacity-60'}`}><div className="flex items-center gap-3"><GripVertical className="w-4 h-4 text-slate-600 shrink-0" /><img src={slide.imageUrl} alt="" className="w-16 h-28 object-cover rounded-xl border border-slate-700 bg-black" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="text-white text-xs truncate">{slide.title}</strong>{slide.enabled ? <span className="text-[9px] text-emerald-400">فعال</span> : <span className="text-[9px] text-slate-500">خاموش</span>}</div><p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{slide.description || slide.altText}</p><div className="flex flex-wrap gap-1.5 mt-2"><button onClick={() => moveSlide(slide.id, -1)} disabled={index === 0} className="px-2 py-1 rounded-lg bg-slate-800 text-[10px] disabled:opacity-30">↑</button><button onClick={() => moveSlide(slide.id, 1)} disabled={index === sortedSlides.length - 1} className="px-2 py-1 rounded-lg bg-slate-800 text-[10px] disabled:opacity-30">↓</button><button onClick={() => toggleSlide(slide.id)} className="px-2 py-1 rounded-lg bg-slate-800 text-[10px]">{slide.enabled ? 'خاموش' : 'فعال'}</button><button onClick={() => removeSlide(slide.id)} className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[10px] flex items-center gap-1"><Trash2 className="w-3 h-3" />حذف</button></div></div></div></div>)}</div>}
            {sortedSlides.length > 0 && <button onClick={() => void save({ ...config, slides: sortedSlides.map((slide, order) => ({ ...slide, order })) })} disabled={saving} className="mt-4 w-full py-2.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"><Check className="w-4 h-4" />ذخیره ترتیب و تغییرات</button>}
          </div>
        </div>
      </div>
    </div>
  );
};