import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Image as ImageIcon, RefreshCw, Sparkles } from 'lucide-react';
import { Article, MediaAsset } from '../types';
import { getAllMediaAssets } from '../utils/mediaService';

type Props = { articles: Article[] };

export const MediaLibraryCoverAssignment: React.FC<Props> = ({ articles }) => {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const missingArticles = useMemo(() => articles.filter(a => !String(a.coverImage || '').trim()), [articles]);
  const selected = assets.find(a => a.id === selectedId) || null;

  const load = async () => {
    setLoading(true); setNotice('');
    try {
      const all = await getAllMediaAssets();
      setAssets(all.filter(a => /^image\\//i.test(a.mimeType) || /\\.(avif|gif|jpe?g|png|svg|webp)$/i.test(a.filename)));
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const assign = async () => {
    if (!selected || !missingArticles.length) return;
    setAssigning(true); setNotice('');
    try {
      const response = await fetch('/api/articles/cover', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ articleIds: missingArticles.map(a => a.id), asset: { id: selected.id, path: selected.path, publicUrl: selected.publicUrl } }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || 'اعمال تصویر ناموفق بود.');
      setNotice(data.message || 'تصویر با موفقیت اعمال شد.');
      window.dispatchEvent(new CustomEvent('solmint:articles-refresh'));
    } catch (error: any) { setNotice(error?.message || 'اعمال تصویر ناموفق بود.'); }
    finally { setAssigning(false); }
  };

  return <section className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4" data-production-cover-assignment="true">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><h4 className="font-bold text-white text-sm flex items-center gap-2"><ImageIcon className="w-4 h-4 text-purple-400" />انتخاب کاور برای مقالات بدون تصویر</h4><p className="text-[11px] text-slate-400 mt-1">یک تصویر واقعی از کتابخانه انتخاب کنید و آن را مستقیماً روی مقالات فاقد کاور اعمال کنید.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading || assigning} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> بازخوانی کتابخانه</button>
    </div>
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
      <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 text-xs cursor-pointer" disabled={loading || assigning}><option value="">انتخاب تصویر کاور...</option>{assets.map(a => <option key={a.id} value={a.id}>{a.filename}</option>)}</select>
      <button type="button" disabled={!selected || !missingArticles.length || assigning} onClick={() => { if (window.confirm(`این تصویر روی ${missingArticles.length} مقاله بدون تصویر اعمال شود؟`)) void assign(); }} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40">{assigning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}اعمال روی {missingArticles.length} مقاله بدون تصویر</button>
    </div>
    {selected && <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800"><img src={selected.publicUrl} alt={selected.altText || selected.filename} className="w-20 h-14 object-cover rounded-lg border border-slate-700" /><div className="min-w-0"><div className="text-white font-bold text-xs truncate">{selected.filename}</div><div className="text-[10px] text-slate-500 font-mono truncate dir-ltr">{selected.path}</div></div></div>}
    <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-3"><span>{missingArticles.length} مقاله بدون تصویر · {assets.length} تصویر در کتابخانه</span>{notice && <span className="text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{notice}</span>}</div>
  </section>;
};
