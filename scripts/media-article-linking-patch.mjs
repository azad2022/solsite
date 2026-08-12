import fs from 'node:fs';

function patchFile(path, transform, description) {
  if (!fs.existsSync(path)) throw new Error(`[media-linking] Missing ${path}`);
  const source = fs.readFileSync(path, 'utf8');
  const result = transform(source);
  if (result === source) throw new Error(`[media-linking] No changes made to ${path} (${description})`);
  fs.writeFileSync(path, result, 'utf8');
  console.log(`✓ [media-linking] ${description}`);
}

patchFile('src/utils/supabaseClient.ts', (source) => {
  const anchor = "      coverImage: item.cover_image || '/images/blog-og.jpg',\n";
  const replacement = anchor + "      coverImageAssetId: item.cover_image_asset_id || undefined,\n";
  if (source.includes("coverImageAssetId: item.cover_image_asset_id")) return source;
  if (!source.includes(anchor)) throw new Error('[media-linking] Supabase article mapping anchor not found');
  return source.replace(anchor, replacement);
}, 'preserve coverImageAssetId when loading articles from Supabase');

patchFile('server.ts', (source) => {
  let out = source;
  const readAnchor = "            coverImage: cleanCover,\n";
  if (!out.includes("coverImageAssetId: item.cover_image_asset_id")) {
    const replacement = readAnchor + "            coverImageAssetId: item.cover_image_asset_id || undefined,\n";
    if (!out.includes(readAnchor)) throw new Error('[media-linking] Server article mapping anchor not found');
    out = out.replace(readAnchor, replacement);
  }

  const writeAnchor = "            cover_image: article.coverImage,\n";
  if (!out.includes("cover_image_asset_id: article.coverImageAssetId")) {
    if (!out.includes(writeAnchor)) throw new Error('[media-linking] Server article write anchor not found');
    out = out.replace(writeAnchor, writeAnchor + "            cover_image_asset_id: article.coverImageAssetId || null,\n");
  }
  return out;
}, 'persist and hydrate coverImageAssetId in server-side article API');

patchFile('src/utils/mediaService.ts', (source) => {
  let out = source;
  if (!out.includes('async function stableMediaAssetId')) {
    const anchor = "/** All privileged media operations are session-authenticated server requests. GitHub credentials never leave the server. */\n";
    if (!out.includes(anchor)) throw new Error('[media-linking] mediaService helper anchor not found');
    const helper = `function stableMediaAssetId(publicUrl: string): string {\n  const normalized = String(publicUrl || '').trim();\n  if (!normalized) return 'media_unknown';\n  try {\n    const utf8 = encodeURIComponent(normalized).replace(/%([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));\n    return 'media_url_' + btoa(utf8).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');\n  } catch {\n    let hash = 2166136261;\n    for (let i = 0; i < normalized.length; i += 1) hash = Math.imul(hash ^ normalized.charCodeAt(i), 16777619);\n    return 'media_fallback_' + (hash >>> 0).toString(16);\n  }\n}\n\n`;
    out = out.replace(anchor, helper + anchor);
  }

  const listOld = "export async function getAllMediaAssets(): Promise<MediaAsset[]> {\n  try { const data = await invokeMediaGateway('list'); return Array.isArray(data?.assets) ? data.assets as MediaAsset[] : []; } catch { return []; }\n}\n";
  if (out.includes(listOld)) {
    const listNew = "export async function getAllMediaAssets(): Promise<MediaAsset[]> {\n  try {\n    const data = await invokeMediaGateway('list');\n    const assets = Array.isArray(data?.assets) ? data.assets as MediaAsset[] : [];\n    return assets.map((asset) => ({ ...asset, id: stableMediaAssetId(asset.publicUrl) }));\n  } catch { return []; }\n}\n";
    out = out.replace(listOld, listNew);
  }

  const uploadOld = "    return { success: true, asset: data.asset as MediaAsset, message: data.message || 'تصویر با موفقیت آپلود شد.' };\n";
  if (out.includes(uploadOld)) {
    const uploadNew = "    const uploadedAsset = data.asset as MediaAsset;\n    return { success: true, asset: { ...uploadedAsset, id: stableMediaAssetId(uploadedAsset.publicUrl) }, message: data.message || 'تصویر با موفقیت آپلود شد.' };\n";
    out = out.replace(uploadOld, uploadNew);
  }
  return out;
}, 'make MediaAsset IDs deterministic from canonical public URLs');

patchFile('src/components/AdminCmsModal.tsx', (source) => {
  let out = source;

  if (!out.includes('setFormCoverImageAssetId(articleToEdit.coverImageAssetId || \'\');')) {
    const editAnchor = "      setFormCoverImage(articleToEdit.coverImage);\n";
    if (!out.includes(editAnchor)) throw new Error('[media-linking] Editor edit cover anchor not found');
    out = out.replace(editAnchor, editAnchor + "      setFormCoverImageAssetId(articleToEdit.coverImageAssetId || '');\n");
  }

  if (!out.includes("setFormCoverImageAssetId('');\n      setFormVideoUrl('');")) {
    const createAnchor = "      setFormCoverImage('https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80');\n      setFormVideoUrl('');\n";
    if (!out.includes(createAnchor)) throw new Error('[media-linking] Editor create cover anchor not found');
    out = out.replace(createAnchor, createAnchor.replace("      setFormVideoUrl('');\n", "      setFormCoverImageAssetId('');\n      setFormVideoUrl('');\n"));
  }

  const coverFieldAnchor = "                        value={formCoverImage}\n                        onChange={(e) => setFormCoverImage(e.target.value)}\n";
  if (out.includes(coverFieldAnchor)) {
    out = out.replace(coverFieldAnchor, "                        value={formCoverImage}\n                        onChange={(e) => { setFormCoverImage(e.target.value); setFormCoverImageAssetId(''); }}\n");
  }

  if (!out.includes('coverImageAssetId: formCoverImageAssetId || undefined,')) {
    const coverSavePattern = "            coverImage: finalCoverImage,\n";
    const occurrences = out.split(coverSavePattern).length - 1;
    if (occurrences < 2) throw new Error(`[media-linking] Expected two article cover save sites, found ${occurrences}`);
    out = out.replaceAll(coverSavePattern, coverSavePattern + "            coverImageAssetId: formCoverImageAssetId || undefined,\n");
  }

  if (!out.includes('const handleSelectMediaAsset = (asset: MediaAsset) => {')) {
    const handlerAnchor = "  // SAVE ARTICLE\n";
    if (!out.includes(handlerAnchor)) throw new Error('[media-linking] SAVE ARTICLE anchor not found');
    const handler = `  // MEDIA LIBRARY -> ARTICLE RELATION\n  const handleSelectMediaAsset = (asset: MediaAsset) => {\n    if (!asset?.id || !asset.publicUrl) {\n      alert('رسانه انتخاب‌شده معتبر نیست.');\n      return;\n    }\n    setFormCoverImage(asset.publicUrl);\n    setFormCoverImageAssetId(asset.id);\n    setIsMediaPickerOpen(false);\n  };\n\n  const handleClearSelectedMediaAsset = () => {\n    setFormCoverImage('');\n    setFormCoverImageAssetId('');\n  };\n\n`;
    out = out.replace(handlerAnchor, handler + handlerAnchor);
  }

  if (!out.includes('id="media-article-picker"')) {
    const lastReturn = out.lastIndexOf("      </div>\n    </div>\n  );\n};");
    if (lastReturn < 0) throw new Error('[media-linking] Component closing anchor not found');

    const picker = `\n      {isMediaPickerOpen && (\n        <div\n          id="media-article-picker"\n          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"\n          role="dialog"\n          aria-modal="true"\n          aria-label="انتخاب تصویر از کتابخانه رسانه"\n          onMouseDown={(e) => { if (e.target === e.currentTarget) setIsMediaPickerOpen(false); }}\n        >\n          <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-3xl bg-slate-950 border border-slate-700 shadow-2xl flex flex-col">\n            <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">\n              <div>\n                <h3 className="text-base font-black text-white flex items-center gap-2">\n                  <ImageIcon className="w-5 h-5 text-[#14F195]" />\n                  انتخاب تصویر از کتابخانه رسانه\n                </h3>\n                <p className="text-[11px] text-slate-400 mt-1">تصویر انتخاب‌شده مستقیماً به همین مقاله متصل می‌شود و شناسه رسانه در دیتابیس ذخیره خواهد شد.</p>\n              </div>\n              <div className="flex items-center gap-2">\n                {formCoverImageAssetId && (\n                  <button type="button" onClick={handleClearSelectedMediaAsset} className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[11px] font-bold">حذف انتخاب فعلی</button>\n                )}\n                <button type="button" onClick={() => setIsMediaPickerOpen(false)} className="p-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-slate-800" aria-label="بستن">\n                  <X className="w-5 h-5" />\n                </button>\n              </div>\n            </div>\n\n            <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-950/80">\n              <div className="relative">\n                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />\n                <input\n                  type="search"\n                  value={mediaSearchQuery}\n                  onChange={(e) => setMediaSearchQuery(e.target.value)}\n                  placeholder="جستجو بر اساس نام فایل، نام اصلی یا عنوان..."\n                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pr-9 pl-3 text-xs text-white outline-none focus:border-[#14F195]/50"\n                />\n              </div>\n            </div>\n\n            <div className="flex-1 overflow-y-auto p-3 sm:p-5">\n              {githubMediaAssets.length === 0 ? (\n                <div className="py-16 text-center text-slate-500 text-xs">کتابخانه رسانه خالی است. ابتدا یک تصویر در بخش رسانه آپلود کنید.</div>\n              ) : (\n                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">\n                  {githubMediaAssets\n                    .filter((asset) => {\n                      const q = mediaSearchQuery.trim().toLowerCase();\n                      if (!q) return true;\n                      return [asset.filename, asset.originalFilename, asset.title, asset.path].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));\n                    })\n                    .map((asset) => {\n                      const usage = articles.filter((article) => article.coverImageAssetId === asset.id || (!article.coverImageAssetId && article.coverImage === asset.publicUrl));\n                      const selected = formCoverImageAssetId === asset.id;\n                      return (\n                        <button\n                          key={asset.id}\n                          type="button"\n                          onClick={() => handleSelectMediaAsset(asset)}\n                          className={`group text-right overflow-hidden rounded-2xl border transition-all cursor-pointer ${selected ? 'border-[#14F195] ring-2 ring-[#14F195]/30 bg-[#14F195]/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}\n                        >\n                          <div className="aspect-[16/10] bg-slate-950 overflow-hidden relative">\n                            <img src={asset.publicUrl} alt={asset.altText || asset.title || asset.filename} loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />\n                            {selected && <span className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-emerald-500 text-slate-950 text-[10px] font-black">انتخاب شده</span>}\n                          </div>\n                          <div className="p-2.5 space-y-1.5">\n                            <div className="font-bold text-white text-[11px] truncate dir-ltr">{asset.filename}</div>\n                            <div className="flex items-center justify-between gap-2 text-[10px]">\n                              <span className="text-slate-500 truncate dir-ltr">{asset.path}</span>\n                              <span className={`shrink-0 px-1.5 py-0.5 rounded-md border ${usage.length ? 'text-amber-300 bg-amber-500/10 border-amber-500/20' : 'text-slate-400 bg-slate-800 border-slate-700'}`}>\n                                {usage.length ? `${usage.length} مقاله` : 'بدون استفاده'}\n                              </span>\n                            </div>\n                          </div>\n                        </button>\n                      );\n                    })}\n                </div>\n              )}\n            </div>\n          </div>\n        </div>\n      )}\n`;
    out = out.slice(0, lastReturn) + picker + out.slice(lastReturn);
  }

  return out;
}, 'wire GitHub media assets to article cover selection and persist asset IDs');

console.log('✓ [media-linking] Production media-to-article linking patch complete.');
