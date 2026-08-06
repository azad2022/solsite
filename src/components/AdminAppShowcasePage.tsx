import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, GripVertical, Image as ImageIcon, RefreshCw, Smartphone, Trash2, Upload, X } from 'lucide-react';
import { fetchCmsSettingsFromApi, saveCmsSettingsToApi } from '../utils/cmsApiClient';
import { saveMediaAssetToSupabase } from '../utils/supabaseClient';
import type { AppShowcaseConfig, AppShowcaseSlide } from './AppShowcase';

const DEFAULT_CONFIG: AppShowcaseConfig = {
  enabled: false,
  model: 'Samsung Galaxy S26 Ultra',
  screenWidth: 1440,
  screenHeight: 3120,
  autoplayMs: 5000,
  slides: []
};

const authHeaders = () => {
  const passcode = (localStorage.getItem('solmint_admin_passcode') || '').trim();
  return { 'Content-Type': 'application/json', 'x-admin-passcode': passcode, Authorization: `Bearer ${passcode}` };
};

async function optimizeShowcaseScreenshot(file: File): Promise<{ base64: string; width: number; height: number; mimeType: string; sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('خواندن فایل تصویر ناموفق بود.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('فایل انتخاب‌شده یک تصویر معتبر نیست.'));
      img.onload = () => {
        const targetRatio = 1440 / 3120;
        const sourceRatio = img.width / img.height;
        if (Math.abs(sourceRatio - targetRatio) / targetRatio > 0.01) {
          reject(new Error('نسبت تصویر باید عملاً 1440×3120 باشد تا Screenshot بدون کشیدگی یا برش داخل قاب نمایش داده شود.'));
          return;
        }

        const scale = Math.min(1440 / img.width, 3120 / img.height, 1);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas مرورگر در دسترس نیست.')); return; }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        let dataUrl = canvas.toDataURL('image/webp', 0.9);
        let mimeType = 'image/webp';
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          mimeType = 'image/jpeg';
        }
        const base64 = dataUrl.split(',')[1] || '';
        resolve({ base64, width, height, mimeType, sizeBytes: Math.round((base64.length * 3) / 4) });
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export const AdminAppShowcasePage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [config, setConfig] = useState<AppShowcaseConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ success: boolean; text: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [altText, setAltText] = useState('');
  const [authenticated, setAuthenticated] = useState(true);

  const activeSlides = useMemo(() => [...config.slides].sort((a, b) => a.order - b.order), [config.slides]);

  const load = async () => {
    setLoading(true);
    try {
      const passcode = localStorage.getItem('solmint_admin_passcode') || '';
      if (!passcode) { setAuthenticated(false); return; }
      const auth = await fetch('/api/media/config', { headers: authHeaders() });
      if (auth.status === 401) { setAuthenticated(false); return; }
      const settings = await fetchCmsSettingsFromApi();
      const saved = (settings as any)?.appShowcase;
      if (saved) setConfig({ ...DEFAULT_CONFIG, ...saved, slides: Array.isArray(saved.slides) ? saved.slides : [] });
    } catch {
      setNotice({ success: false, text: 'دریافت تنظیمات Showcase ناموفق بود.' });
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const save = async (next: AppShowcaseConfig = config) => {
    setSaving(true);
    setNotice(null);
    const ok = await saveCmsSettingsToApi({ appShowcase: next } as any);
    setSaving(false);
    setNotice({ success: ok, text: ok ? 'تنظیمات Showcase با موفقیت ذخیره شد.' : 'ذخیره تنظیمات Showcase ناموفق بود.' });
  };

  const upload = async () => {
    if (!selectedFile || !title.trim()) {
      setNotice({ success: false, text: 'تصویر و عنوان صفحه را وارد کنید.' });
      return;
    }
    setUploading(true);
    setNotice(null);
    try {
      const optimized = await optimizeShowcaseScreenshot(selectedFile);
      if (optimized.sizeBytes > 7 * 1024 * 1024) throw new Error('حجم تصویر نهایی بیش از حد مجاز است. Screenshot را با فشرده‌سازی مناسب‌تر تهیه کنید.');
      const safeSlug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `screen-${Date.now()}`;
      const filename = `app-showcase-${safeSlug}-${Date.now()}.webp`;
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          base64: optimized.base64,
          filename,
          originalFilename: selectedFile.name,
          mimeType: optimized.mimeType,
          width: optimized.width,
          height: optimized.height,
          altText: altText.trim() || title.trim(),
          title: title.trim(),
          overwrite: false
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.asset) throw new Error(data.message || 'آپلود تصویر ناموفق بود.');
      await saveMediaAssetToSupabase(data.asset);

      const slide: AppShowcaseSlide = {
        id: `showcase-${Date.now()}`,
        title: title.trim(),
        description: description.trim(),
        assetId: data.asset.id,
        imageUrl: data.asset.publicUrl,
        altText: altText.trim() || title.trim(),
        order: config.slides.length,
        enabled: true
      };
      const next = { ...config, slides: [...config.slides, slide] };
      setConfig(next);
      await save(next);
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setAltText('');
      const input = document.getElementById('showcase-upload') as HTMLInputElement | null;
      if (input) input.value = '';
      setNotice({ success: true, text: 'Screenshot با موفقیت آپلود، در کتابخانه رسانه ثبت و به Showcase اضافه شد.' });
    } catch (error: any) {
      setNotice({ success: false, text: error?.message || 'خطای ناشناخته در آپلود.' });
    } finally { setUploading(false); }
  };

  const toggleSlide = async (id: string) => {
    const next = { ...config, slides: config.slides.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s) };
    setConfig(next); await save(next);
  };

  const removeSlide = async (id: string) => {
    if (!window.confirm('آیا از حذف این Screenshot از Showcase اطمینان دارید؟ فایل از کتابخانه رسانه حذف نمی‌شود.')) return;
    const nextSlides = config.slides.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i }));
    const next = { ...config, slides: nextSlides };
    setConfig(next); await save(next);
  };

  const move = async (id: string, direction: -1 | 1) => {
    const ordered = [...config.slides].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex(s => s.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const next = { ...config, slides: ordered.map((s, i) => ({ ...s, order: i })) };
    setConfig(next); await save(next);
  };

  if (!authenticated) {
    return <div dir="rtl" className="min-h-screen bg-[#08080f] text-white flex items-center justify-center p-6"><div className="max-w-md text-center space-y-4"><h1 className="text-2xl font-black">دسترسی مدیر لازم است</h1><p className="text-slate-400 text-sm">ابتدا وارد پنل مدیریت Solmint شوید.</p><button onClick={() => onNavigate('/admin')} className="px-5 py-3 rounded-xl bg-[#14F195] text-slate-950 font-bold">ورود به پنل مدیریت</button></div></div>;
  }

  if (loading) return <div className="min-h-screen bg-[#08080f] flex items-center justify-center text-slate-400"><RefreshCw className="w-6 h-6 animate-spin" /></div>;

  return (
    <main dir="rtl" className="min-h-screen bg-[#08080f] text-slate-100 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[#14F195] text-xs font-bold mb-2"><Smartphone className="w-4 h-4" /> مدیریت نمایش اپلیکیشن</div>
            <h1 className="text-2xl sm:text-3xl font-black">App Showcase — {config.model}</h1>
            <p className="text-sm text-slate-400 mt-2">تمام تصاویر این بخش Screenshot نسخه انگلیسی اپلیکیشن هستند و سایت فقط آن‌ها را داخل قاب موبایل نمایش می‌دهد.</p>
          </div>
          <button onClick={() => onNavigate('/admin')} className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2"><ArrowRight className="w-4 h-4" /> پنل مدیریت</button>
        </header>

        <section className="p-5 rounded-3xl bg-slate-900/80 border border-emerald-500/20 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-black text-lg">کنترل کلی نمایش</h2><p className="text-xs text-slate-400 mt-1">با خاموش کردن این گزینه، کل بخش موبایل از صفحه اصلی حذف می‌شود.</p></div>
            <button type="button" onClick={() => { const next = { ...config, enabled: !config.enabled }; setConfig(next); void save(next); }} className={`relative w-14 h-8 rounded-full transition-colors ${config.enabled ? 'bg-[#14F195]' : 'bg-slate-700'}`} aria-label="فعال یا غیرفعال کردن Showcase"><span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-[-28px]' : 'translate-x-[-4px]'}`} /></button>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800"><span className="text-slate-500 block">مدل نمایش</span><strong className="text-white">{config.model}</strong></div>
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800"><span className="text-slate-500 block">رزولوشن مرجع</span><strong className="text-white font-mono">{config.screenWidth} × {config.screenHeight}px</strong></div>
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800"><label className="text-slate-500 block mb-1">فاصله اسلایدها</label><input type="number" min={1500} max={30000} step={500} value={config.autoplayMs} onChange={e => setConfig({ ...config, autoplayMs: Number(e.target.value) || 5000 })} onBlur={() => void save()} className="w-full bg-transparent text-white font-mono outline-none" /></div>
          </div>
        </section>

        <section className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2"><Upload className="w-5 h-5 text-[#14F195]" /><h2 className="font-black text-lg">افزودن Screenshot جدید</h2></div>
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 leading-6">
            <strong>استاندارد پیشنهادی:</strong> Screenshot نسخه انگلیسی اپلیکیشن با رزولوشن <b>1440 × 3120 پیکسل</b> و همان نسبت تصویر. PNG یا JPG قابل قبول است؛ سیستم قبل از آپلود آن را به WebP بهینه می‌کند. Screenshot نباید داخل خودش قاب موبایل، حاشیه وب‌سایت یا Mockup داشته باشد.
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <input id="showcase-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs file:ml-3 file:rounded-lg file:border-0 file:bg-[#14F195] file:text-slate-950 file:font-bold file:px-3 file:py-1.5" />
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="عنوان صفحه، مثال: Wallet" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs" />
              <input value={altText} onChange={e => setAltText(e.target.value)} placeholder="Alt Text انگلیسی برای تصویر" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs" dir="ltr" />
            </div>
            <div className="space-y-3">
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="توضیح کوتاه این صفحه برای کنار Showcase..." className="w-full h-28 bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs resize-none" />
              <button type="button" onClick={upload} disabled={uploading || !selectedFile || !title.trim()} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#14F195] to-cyan-400 text-slate-950 font-black text-xs disabled:opacity-40 flex items-center justify-center gap-2">{uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {uploading ? 'در حال پردازش و آپلود...' : 'آپلود و افزودن به Showcase'}</button>
            </div>
          </div>
        </section>

        {notice && <div className={`p-4 rounded-2xl text-xs font-bold border ${notice.success ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'}`}>{notice.text}</div>}

        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-lg font-black">صفحات Showcase ({activeSlides.length})</h2><span className="text-xs text-slate-500">تغییرات بلافاصله در تنظیمات سایت ذخیره می‌شوند.</span></div>
          {activeSlides.length === 0 ? <div className="p-10 rounded-3xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-sm">هنوز Screenshot اضافه نشده است.</div> : activeSlides.map((slide, index) => (
            <div key={slide.id} className={`p-4 rounded-2xl bg-slate-900 border ${slide.enabled ? 'border-slate-700' : 'border-rose-500/20 opacity-70'} flex flex-col sm:flex-row gap-4 items-start sm:items-center`}>
              <div className="w-24 aspect-[1440/3120] rounded-xl overflow-hidden bg-black border border-slate-700 shrink-0"><img src={slide.imageUrl} alt={slide.altText} className="w-full h-full object-fill" /></div>
              <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><GripVertical className="w-4 h-4 text-slate-600" /><h3 className="font-bold text-white">{slide.title}</h3>{slide.enabled ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">فعال</span> : <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300">مخفی</span>}</div><p className="text-xs text-slate-400 mt-1">{slide.description || 'بدون توضیح'}</p><div className="text-[10px] text-slate-600 font-mono mt-2">{slide.assetId} · {slide.imageUrl}</div></div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => void move(slide.id, -1)} disabled={index === 0} className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-30" title="بالا"><ArrowRight className="w-4 h-4 rotate-90" /></button>
                <button onClick={() => void move(slide.id, 1)} disabled={index === activeSlides.length - 1} className="p-2 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-30" title="پایین"><ArrowRight className="w-4 h-4 -rotate-90" /></button>
                <button onClick={() => void toggleSlide(slide.id)} className="p-2 rounded-lg bg-slate-800 text-slate-300" title={slide.enabled ? 'مخفی کردن' : 'نمایش دادن'}>{slide.enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                <button onClick={() => void removeSlide(slide.id)} className="p-2 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20" title="حذف از Showcase"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </section>

        <footer className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-500 leading-6">
          <div className="flex items-center gap-2 text-slate-300 font-bold mb-1"><ImageIcon className="w-4 h-4" /> نکته نگهداری</div>
          حذف یک صفحه از Showcase، فایل تصویر را از کتابخانه رسانه حذف نمی‌کند. این رفتار عمدی است تا حذف اشتباهی تصویر مورد استفاده در بخش‌های دیگر سایت باعث خرابی محتوا نشود.
        </footer>
      </div>
    </main>
  );
};
