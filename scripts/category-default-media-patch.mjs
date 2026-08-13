import fs from 'node:fs';

function patch(path, transform, description) {
  if (!fs.existsSync(path)) throw new Error(`[category-media] Missing ${path}`);
  const source = fs.readFileSync(path, 'utf8');
  const result = transform(source);
  if (result === source) {
    console.log(`✓ [category-media] ${description} already present.`);
    return;
  }
  fs.writeFileSync(path, result, 'utf8');
  console.log(`✓ [category-media] ${description}`);
}

patch('functions/api/article-categories.ts', source => {
  const canonical = source.includes('default_media_asset_id?: string | null')
    && source.includes('default_media_url?: string | null')
    && source.includes('default_media_asset_id: category.default_media_asset_id || null')
    && source.includes('default_media_url: category.default_media_url || null');
  if (canonical) return source;

  let out = source;
  out = out.replace(
    "type Category = { id: string; name: string; slug: string; description?: string; seo_title?: string; seo_description?: string; parent_id?: string | null; sort_order?: number; is_active?: boolean; created_at?: string; updated_at?: string };",
    "type Category = { id: string; name: string; slug: string; description?: string; seo_title?: string; seo_description?: string; parent_id?: string | null; sort_order?: number; is_active?: boolean; default_media_asset_id?: string | null; default_media_url?: string | null; created_at?: string; updated_at?: string };"
  );
  out = out.replace(
    "function cleanCategory(input: any): Category { return { id: String(input.id || `cat-${crypto.randomUUID()}`), name: String(input.name || '').trim(), slug: String(input.slug || '').trim().toLowerCase(), description: String(input.description || '').trim(), seo_title: String(input.seo_title || '').trim(), seo_description: String(input.seo_description || '').trim(), parent_id: input.parent_id ? String(input.parent_id) : null, sort_order: Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : 100, is_active: input.is_active !== false }; }",
    "function cleanCategory(input: any): Category { return { id: String(input.id || `cat-${crypto.randomUUID()}`), name: String(input.name || '').trim(), slug: String(input.slug || '').trim().toLowerCase(), description: String(input.description || '').trim(), seo_title: String(input.seo_title || '').trim(), seo_description: String(input.seo_description || '').trim(), parent_id: input.parent_id ? String(input.parent_id) : null, sort_order: Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : 100, is_active: input.is_active !== false, default_media_asset_id: input.default_media_asset_id ? String(input.default_media_asset_id).trim() : null, default_media_url: input.default_media_url ? String(input.default_media_url).trim() : null }; }"
  );
  out = out.replace(
    "body: JSON.stringify({ name: patch.name, slug: patch.slug, description: patch.description, seo_title: patch.seo_title, seo_description: patch.seo_description, parent_id: patch.parent_id, sort_order: patch.sort_order, is_active: patch.is_active, updated_at: new Date().toISOString() })",
    "body: JSON.stringify({ name: patch.name, slug: patch.slug, description: patch.description, seo_title: patch.seo_title, seo_description: patch.seo_description, parent_id: patch.parent_id, sort_order: patch.sort_order, is_active: patch.is_active, default_media_asset_id: patch.default_media_asset_id || null, default_media_url: patch.default_media_url || null, updated_at: new Date().toISOString() })"
  );
  out = out.replace(
    "body: JSON.stringify(category) });",
    "body: JSON.stringify({ ...category, default_media_asset_id: category.default_media_asset_id || null, default_media_url: category.default_media_url || null }) });"
  );
  return out;
}, 'persist category default media fields');

patch('src/components/ArticleCategoryManager.tsx', source => {
  const canonical = source.includes("const authHeaders = (): Record<string, string> => ({ 'Content-Type': 'application/json' });")
    && source.includes('default_media_asset_id?: string | null;')
    && source.includes('default_media_url?: string | null;')
    && source.includes('const [mediaAssets, setMediaAssets]')
    && source.includes('const [mediaLoading, setMediaLoading]')
    && source.includes('data-category-default-media')
    && source.includes('default_media_asset_id: form.default_media_asset_id || null');
  if (canonical) return source;

  let out = source;
  if (!out.includes("const authHeaders = (): Record<string, string> => ({ 'Content-Type': 'application/json' });")) {
    const authStart = out.indexOf('const authHeaders =');
    const fetchStart = out.indexOf('export const fetchArticleCategories', authStart);
    if (authStart >= 0 && fetchStart > authStart) {
      out = `${out.slice(0, authStart)}const authHeaders = (): Record<string, string> => ({ 'Content-Type': 'application/json' });\n\n${out.slice(fetchStart)}`;
    }
  }
  if (!out.includes("import { getAllMediaAssets } from '../utils/mediaService';")) {
    const anchor = "import { CheckCircle2, Edit3, FolderTree, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';\n";
    if (out.includes(anchor)) out = out.replace(anchor, anchor + "import { getAllMediaAssets } from '../utils/mediaService';\n");
  }
  if (!out.includes('default_media_asset_id?: string | null;')) out = out.replace('  updated_at: string;\n}', '  updated_at: string;\n  default_media_asset_id?: string | null;\n  default_media_url?: string | null;\n}');
  if (!out.includes('default_media_asset_id: string; default_media_url: string;')) out = out.replace('interface FormState { name: string; slug: string; description: string; seo_title: string; seo_description: string; parent_id: string; sort_order: string; is_active: boolean; }', 'interface FormState { name: string; slug: string; description: string; seo_title: string; seo_description: string; parent_id: string; sort_order: string; is_active: boolean; default_media_asset_id: string; default_media_url: string; }');
  if (!out.includes("default_media_asset_id: '', default_media_url: ''")) out = out.replace("is_active: true });", "is_active: true, default_media_asset_id: '', default_media_url: '' });");
  if (!out.includes('const [mediaAssets, setMediaAssets]')) out = out.replace("  const [notice, setNotice] = useState<{ success?: boolean; message: string } | null>(null);", "  const [notice, setNotice] = useState<{ success?: boolean; message: string } | null>(null);\n  const [mediaAssets, setMediaAssets] = useState<Array<{ id: string; filename: string; publicUrl: string; title?: string; altText?: string }>>([]);\n  const [mediaLoading, setMediaLoading] = useState(false);");
  if (!out.includes('loadMediaAssets')) out = out.replace('  useEffect(() => { void load(); }, []);', "  useEffect(() => { void load(); void loadMediaAssets(); }, []);\n\n  const loadMediaAssets = async () => {\n    setMediaLoading(true);\n    try {\n      const { getAllMediaAssets } = await import('../utils/mediaService');\n      const assets = await getAllMediaAssets();\n      setMediaAssets(assets as any);\n    } catch {} finally { setMediaLoading(false); }\n  };");
  if (!out.includes('default_media_asset_id: form.default_media_asset_id || null')) out = out.replace('sort_order: Number(form.sort_order) || 100 }', 'sort_order: Number(form.sort_order) || 100, default_media_asset_id: form.default_media_asset_id || null, default_media_url: form.default_media_url || null }');
  if (!out.includes('category.default_media_asset_id ||')) out = out.replace('is_active: category.is_active });', "is_active: category.is_active, default_media_asset_id: category.default_media_asset_id || '', default_media_url: category.default_media_url || '' });");
  if (!out.includes('data-category-default-media')) {
    const anchor = "      <button type=\"submit\" disabled={saving} className=\"px-5 py-3 rounded-xl btn-gradient text-black font-extrabold flex items-center gap-2 cursor-pointer disabled:opacity-50\">";
    const section = `      <div data-category-default-media className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"><div className="flex items-center justify-between gap-3"><div><h5 className="font-bold text-white">تصویر پیش‌فرض دسته‌بندی</h5><p className="text-[11px] text-slate-400 mt-1">اگر مقاله در این دسته تصویر اختصاصی نداشته باشد، این تصویر به‌صورت خودکار برای آن استفاده می‌شود.</p></div><button type="button" onClick={() => void loadMediaAssets()} className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-[10px] font-bold">بروزرسانی رسانه‌ها</button></div>{form.default_media_url && <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30"><img src={form.default_media_url} alt="تصویر پیش‌فرض" className="w-20 h-14 object-cover rounded-lg" /><div className="min-w-0"><div className="text-xs font-bold text-emerald-300">تصویر پیش‌فرض انتخاب شده</div><div className="text-[10px] text-slate-500 truncate dir-ltr">{form.default_media_url}</div></div></div>}</div>\n\n`;
    if (out.includes(anchor)) out = out.replace(anchor, section + anchor);
  }
  return out;
}, 'wire canonical category media picker');

console.log('✓ [category-media] Category default media patch ready.');
