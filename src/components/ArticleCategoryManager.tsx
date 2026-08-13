import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Edit3, FolderTree, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';

export interface ArticleCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  seo_title: string;
  seo_description: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  default_media_asset_id?: string | null;
  default_media_url?: string | null;
  created_at: string;
  updated_at: string;
}

const FALLBACK_CATEGORIES: ArticleCategory[] = [
  { id: 'cat-solana', name: 'آموزش سولانا', slug: 'solana', description: '', seo_title: '', seo_description: '', parent_id: null, sort_order: 10, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-web3', name: 'توسعه وب۳', slug: 'web3-development', description: '', seo_title: '', seo_description: '', parent_id: null, sort_order: 20, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-security', name: 'امنیت', slug: 'security', description: '', seo_title: '', seo_description: '', parent_id: null, sort_order: 30, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-news-analysis', name: 'اخبار و تحلیل', slug: 'crypto-news-analysis', description: '', seo_title: '', seo_description: '', parent_id: null, sort_order: 40, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-trading', name: 'ترید', slug: 'trading', description: '', seo_title: '', seo_description: '', parent_id: null, sort_order: 50, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-prop-trading', name: 'پراپ تریدینگ', slug: 'prop-trading', description: '', seo_title: '', seo_description: '', parent_id: null, sort_order: 60, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-meme-coin', name: 'آموزش ساخت میم کوین', slug: 'meme-coin', description: '', seo_title: '', seo_description: '', parent_id: null, sort_order: 70, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-nft', name: 'آموزش ساخت NFT', slug: 'nft', description: '', seo_title: '', seo_description: '', parent_id: null, sort_order: 80, is_active: true, created_at: '', updated_at: '' },
  { id: 'cat-wallet', name: 'کیف پول سولانا', slug: 'solana-wallet', description: '', seo_title: '', seo_description: '', parent_id: null, sort_order: 90, is_active: true, created_at: '', updated_at: '' }
];

const authHeaders = (): Record<string, string> => ({ 'Content-Type': 'application/json' });

export const fetchArticleCategories = async (includeInactive = false, allowFallback = false): Promise<ArticleCategory[]> => {
  const query = includeInactive ? '?includeInactive=true' : '';
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`/api/article-categories${query}`, { headers: authHeaders(), signal: controller.signal, cache: 'no-store' });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || `خطا در دریافت دسته‌بندی‌ها (${response.status})`);
    const categories = Array.isArray(payload?.categories) ? payload.categories : [];
    if (!categories.length) throw new Error('سرویس دسته‌بندی‌ها پاسخ خالی برگرداند.');
    return categories;
  } catch (error) {
    if (allowFallback) return FALLBACK_CATEGORIES.filter(category => includeInactive || category.is_active);
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('دریافت دسته‌بندی‌ها بیش از ۷ ثانیه طول کشید. وضعیت اتصال API دسته‌بندی‌ها را بررسی کنید.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

export const createArticleCategory = async (payload: Partial<ArticleCategory>): Promise<ArticleCategory> => {
  const response = await fetch('/api/article-categories', { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.category) throw new Error(data?.message || `خطا در ایجاد دسته‌بندی (${response.status})`);
  return data.category;
};

export const updateArticleCategory = async (id: string, payload: Partial<ArticleCategory>): Promise<ArticleCategory> => {
  const response = await fetch(`/api/article-categories/${encodeURIComponent(id)}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(payload) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.category) throw new Error(data?.message || `خطا در ویرایش دسته‌بندی (${response.status})`);
  return data.category;
};

export const deleteArticleCategory = async (id: string): Promise<void> => {
  const response = await fetch(`/api/article-categories/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || `خطا در حذف دسته‌بندی (${response.status})`);
};

interface FormState { name: string; slug: string; description: string; seo_title: string; seo_description: string; parent_id: string; sort_order: string; is_active: boolean; default_media_asset_id: string; default_media_url: string; }
const emptyForm = (): FormState => ({ name: '', slug: '', description: '', seo_title: '', seo_description: '', parent_id: '', sort_order: '100', is_active: true, default_media_asset_id: '', default_media_url: '' });

export const ArticleCategoryManager: React.FC = () => {
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ success?: boolean; message: string } | null>(null);
  const [mediaAssets, setMediaAssets] = useState<Array<{ id: string; filename: string; publicUrl: string; title?: string; altText?: string }>>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setCategories(await fetchArticleCategories(true)); }
    catch (error: any) { setNotice({ success: false, message: error?.message || 'دریافت دسته‌بندی‌ها ناموفق بود.' }); }
    finally { setLoading(false); }
  };

  const loadMediaAssets = async () => {
    setMediaLoading(true);
    try {
      const { getAllMediaAssets } = await import('../utils/mediaService');
      const assets = await getAllMediaAssets();
      setMediaAssets(assets as any);
    } catch { setMediaAssets([]); }
    finally { setMediaLoading(false); }
  };

  useEffect(() => { void load(); void loadMediaAssets(); }, []);

  const filtered = useMemo(() => categories.filter(c => `${c.name} ${c.slug}`.toLocaleLowerCase('fa-IR').includes(search.trim().toLocaleLowerCase('fa-IR'))), [categories, search]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return setNotice({ success: false, message: 'نام دسته‌بندی الزامی است.' });
    if (!form.slug.trim()) return setNotice({ success: false, message: 'Slug دسته‌بندی الزامی است.' });
    setSaving(true); setNotice(null);
    try {
      const payload = { ...form, name: form.name.trim(), slug: form.slug.trim(), parent_id: form.parent_id || null, sort_order: Number(form.sort_order) || 100, default_media_asset_id: form.default_media_asset_id || null, default_media_url: form.default_media_url || null };
      if (editingId) await updateArticleCategory(editingId, payload);
      else await createArticleCategory(payload);
      setForm(emptyForm()); setEditingId(null); await load();
      setNotice({ success: true, message: editingId ? 'دسته‌بندی با موفقیت ویرایش شد.' : 'دسته‌بندی جدید با موفقیت ایجاد شد.' });
    } catch (error: any) { setNotice({ success: false, message: error?.message || 'ذخیره دسته‌بندی ناموفق بود.' }); }
    finally { setSaving(false); }
  };

  const edit = (category: ArticleCategory) => setForm({ name: category.name, slug: category.slug, description: category.description || '', seo_title: category.seo_title || '', seo_description: category.seo_description || '', parent_id: category.parent_id || '', sort_order: String(category.sort_order), is_active: category.is_active, default_media_asset_id: category.default_media_asset_id || '', default_media_url: category.default_media_url || '' });
  const startEdit = (category: ArticleCategory) => { edit(category); setEditingId(category.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const remove = async (category: ArticleCategory) => {
    if (!window.confirm(`آیا از حذف «${category.name}» مطمئن هستید؟ اگر مقاله‌ای به این دسته متصل باشد، حذف توسط سرور رد خواهد شد.`)) return;
    try { await deleteArticleCategory(category.id); await load(); setNotice({ success: true, message: 'دسته‌بندی حذف شد.' }); }
    catch (error: any) { setNotice({ success: false, message: error?.message || 'حذف دسته‌بندی ناموفق بود.' }); }
  };

  return <div className="space-y-5 text-xs" dir="rtl">
    <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/80 via-slate-900 to-blue-950/80 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3"><div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"><FolderTree className="w-6 h-6" /></div><div><h3 className="text-white font-extrabold text-base">مدیریت دسته‌بندی مقالات</h3><p className="text-slate-400 mt-1 leading-6">دسته‌ها از Supabase خوانده می‌شوند و افزودن یا ویرایش آنها نیاز به تغییر سورس سایت ندارد.</p></div></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />بروزرسانی</button>
    </div>
    {notice && <div className={`p-3.5 rounded-2xl border flex items-center gap-2 font-bold ${notice.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}><CheckCircle2 className="w-4 h-4 shrink-0" />{notice.message}</div>}
    <form onSubmit={submit} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between"><h4 className="font-bold text-white flex items-center gap-2"><Plus className="w-4 h-4 text-emerald-400" />{editingId ? 'ویرایش دسته‌بندی' : 'افزودن دسته‌بندی جدید'}</h4>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm()); }} className="text-slate-400 hover:text-white flex items-center gap-1"><X className="w-3.5 h-3.5" />لغو ویرایش</button>}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="نام دسته‌بندی؛ مثال: دیفای سولانا" className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-white" />
        <input required value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="slug؛ مثال: solana-defi" dir="ltr" className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono" />
        <input value={form.seo_title} onChange={e => setForm({ ...form, seo_title: e.target.value })} placeholder="عنوان SEO اختصاصی (اختیاری)" className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-white" />
        <input value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} type="number" min="0" placeholder="ترتیب نمایش" className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono" />
        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="توضیحات دسته برای صفحه آرشیو" className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-white" />
        <textarea value={form.seo_description} onChange={e => setForm({ ...form, seo_description: e.target.value })} rows={2} placeholder="Meta Description دسته" className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-white" />
        <select value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value })} className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-white"><option value="">بدون دسته والد</option>{categories.filter(c => c.id !== editingId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <label className="bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-300 flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />نمایش دسته در سایت و فرم ایجاد مقاله</label>
      </div>

      <div data-category-default-media className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div><h5 className="font-bold text-white">تصویر پیش‌فرض دسته‌بندی</h5><p className="text-[11px] text-slate-400 mt-1">اگر مقاله در این دسته تصویر اختصاصی نداشته باشد، این تصویر به‌صورت خودکار برای آن استفاده می‌شود.</p></div>
          <button type="button" onClick={() => void loadMediaAssets()} className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-[10px] font-bold">بروزرسانی رسانه‌ها</button>
        </div>
        {form.default_media_url && <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30"><img src={form.default_media_url} alt="تصویر پیش‌فرض" className="w-20 h-14 object-cover rounded-lg" /><div className="min-w-0"><div className="text-xs font-bold text-emerald-300">تصویر پیش‌فرض انتخاب شده</div><div className="text-[10px] text-slate-500 truncate dir-ltr">{form.default_media_url}</div></div><button type="button" onClick={() => setForm({ ...form, default_media_asset_id: '', default_media_url: '' })} className="mr-auto px-2 py-1 rounded-lg bg-rose-500/10 text-rose-300 text-[10px] font-bold">حذف</button></div>}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 max-h-72 overflow-y-auto">
          {mediaLoading ? <div className="col-span-full py-8 text-center text-slate-500 text-xs">در حال دریافت کتابخانه رسانه...</div> : mediaAssets.length === 0 ? <div className="col-span-full py-8 text-center text-slate-500 text-xs">رسانه‌ای برای انتخاب وجود ندارد.</div> : mediaAssets.map(asset => { const selected = form.default_media_asset_id === asset.id; return <button key={asset.id} type="button" onClick={() => setForm({ ...form, default_media_asset_id: asset.id, default_media_url: asset.publicUrl })} className={`text-right rounded-xl overflow-hidden border transition-all ${selected ? 'border-emerald-400 ring-2 ring-emerald-400/20' : 'border-slate-800 hover:border-slate-600'}`}><img src={asset.publicUrl} alt={asset.altText || asset.title || asset.filename} loading="lazy" className="w-full aspect-[16/10] object-cover" /><span className="block px-2 py-1.5 text-[10px] text-slate-300 truncate dir-ltr">{asset.filename}</span></button>; })}
        </div>
      </div>

      <button type="submit" disabled={saving} className="px-5 py-3 rounded-xl btn-gradient text-black font-extrabold flex items-center gap-2 cursor-pointer disabled:opacity-50">{saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{editingId ? 'ذخیره تغییرات' : 'ایجاد دسته‌بندی'}</button>
    </form>

    <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between"><h4 className="font-bold text-white">دسته‌های موجود ({categories.length})</h4><div className="relative"><Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..." className="bg-slate-950 border border-slate-700 rounded-xl py-2 pr-9 pl-3 text-white text-xs" /></div></div>
      <div className="space-y-2">{filtered.map(category => <div key={category.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-bold text-white">{category.name}</span><code className="text-[10px] text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded">/{category.slug}</code><span className={`text-[10px] px-2 py-0.5 rounded ${category.is_active ? 'text-emerald-300 bg-emerald-500/10' : 'text-slate-400 bg-slate-800'}`}>{category.is_active ? 'فعال' : 'غیرفعال'}</span></div><p className="text-[10px] text-slate-500 mt-1">ترتیب: {category.sort_order}{category.description ? ` · ${category.description}` : ''}</p></div><div className="flex items-center gap-2 shrink-0"><button type="button" onClick={() => startEdit(category)} className="p-2 rounded-lg bg-slate-800 text-sky-400 hover:bg-slate-700" title="ویرایش"><Edit3 className="w-4 h-4" /></button><button type="button" onClick={() => void remove(category)} className="p-2 rounded-lg bg-slate-800 text-rose-400 hover:bg-slate-700" title="حذف"><Trash2 className="w-4 h-4" /></button></div></div>)}{!filtered.length && <p className="text-center text-slate-500 py-6">دسته‌ای پیدا نشد.</p>}</div>
    </div>
  </div>;
};

export const ArticleCategorySelect: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => {
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    fetchArticleCategories(false, true)
      .then(data => { if (mounted) setCategories(data); })
      .catch(e => { if (mounted) setError(e?.message || 'خطا در دریافت دسته‌ها'); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => { if (!value && categories[0]) onChange(categories[0].name); }, [categories, value, onChange]);
  return <div className="space-y-1"><select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200" disabled={!categories.length}><option value="">{error || (categories.length ? 'انتخاب دسته‌بندی' : 'در حال دریافت دسته‌بندی‌ها...')}</option>{categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}</select>{error && <span className="text-[10px] text-rose-400">{error}</span>}</div>;
};
