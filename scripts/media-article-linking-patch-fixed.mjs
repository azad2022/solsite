import fs from 'node:fs';

function patchFile(path, transform, description) {
  if (!fs.existsSync(path)) throw new Error(`[media-linking] Missing ${path}`);
  const source = fs.readFileSync(path, 'utf8');
  const result = transform(source);
  if (result === source) throw new Error(`[media-linking] No changes made to ${path}: ${description}`);
  fs.writeFileSync(path, result, 'utf8');
  console.log(`✓ [media-linking] ${description}`);
}

patchFile('src/utils/supabaseClient.ts', source => {
  if (source.includes('coverImageAssetId: item.cover_image_asset_id || undefined')) return source;
  const anchor = "      coverImage: item.cover_image || '/images/blog-og.jpg',\n";
  if (!source.includes(anchor)) throw new Error('[media-linking] Supabase article mapping anchor not found');
  return source.replace(anchor, anchor + "      coverImageAssetId: item.cover_image_asset_id || undefined,\n");
}, 'preserve coverImageAssetId when loading articles');

patchFile('server.ts', source => {
  let out = source;
  if (!out.includes('coverImageAssetId: item.cover_image_asset_id || undefined')) {
    const anchor = "            coverImage: cleanCover,\n";
    if (!out.includes(anchor)) throw new Error('[media-linking] Server article mapping anchor not found');
    out = out.replace(anchor, anchor + "            coverImageAssetId: item.cover_image_asset_id || undefined,\n");
  }
  if (!out.includes('cover_image_asset_id: article.coverImageAssetId || null')) {
    const anchor = "            cover_image: article.coverImage,\n";
    if (!out.includes(anchor)) throw new Error('[media-linking] Server article write anchor not found');
    out = out.replace(anchor, anchor + "            cover_image_asset_id: article.coverImageAssetId || null,\n");
  }
  return out;
}, 'persist coverImageAssetId in server article API');

patchFile('src/utils/mediaService.ts', source => {
  let out = source;
  if (!out.includes('function stableMediaAssetId(publicUrl: string): string')) {
    const anchor = "/** All privileged media operations are session-authenticated server requests. GitHub credentials never leave the server. */\n";
    if (!out.includes(anchor)) throw new Error('[media-linking] mediaService helper anchor not found');
    const helper = [
      'function stableMediaAssetId(publicUrl: string): string {',
      "  const normalized = String(publicUrl || '').trim();",
      "  if (!normalized) return 'media_unknown';",
      '  try {',
      '    let hash = 2166136261;',
      "    for (let i = 0; i < normalized.length; i += 1) hash = Math.imul(hash ^ normalized.charCodeAt(i), 16777619);",
      "    return 'media_url_' + (hash >>> 0).toString(16);",
      "  } catch { return 'media_unknown'; }",
      '}',
      '',
      ''
    ].join('\n');
    out = out.replace(anchor, helper + anchor);
  }
  const oldList = "export async function getAllMediaAssets(): Promise<MediaAsset[]> {\n  try { const data = await invokeMediaGateway('list'); return Array.isArray(data?.assets) ? data.assets as MediaAsset[] : []; } catch { return []; }\n}\n";
  if (out.includes(oldList)) {
    out = out.replace(oldList, "export async function getAllMediaAssets(): Promise<MediaAsset[]> {\n  try {\n    const data = await invokeMediaGateway('list');\n    const assets = Array.isArray(data?.assets) ? data.assets as MediaAsset[] : [];\n    return assets.map((asset) => ({ ...asset, id: stableMediaAssetId(asset.publicUrl) }));\n  } catch { return []; }\n}\n");
  }
  const oldUpload = "    return { success: true, asset: data.asset as MediaAsset, message: data.message || 'تصویر با موفقیت آپلود شد.' };\n";
  if (out.includes(oldUpload)) {
    out = out.replace(oldUpload, "    const uploadedAsset = data.asset as MediaAsset;\n    return { success: true, asset: { ...uploadedAsset, id: stableMediaAssetId(uploadedAsset.publicUrl) }, message: data.message || 'تصویر با موفقیت آپلود شد.' };\n");
  }
  return out;
}, 'use deterministic media asset identifiers');

patchFile('src/components/AdminCmsModal.tsx', source => {
  let out = source;

  if (!out.includes("setFormCoverImageAssetId(articleToEdit.coverImageAssetId || '')")) {
    const anchor = "      setFormCoverImage(articleToEdit.coverImage);\n";
    if (!out.includes(anchor)) throw new Error('[media-linking] Edit cover anchor not found');
    out = out.replace(anchor, anchor + "      setFormCoverImageAssetId(articleToEdit.coverImageAssetId || '');\n");
  }

  const defaultCover = "      setFormCoverImage('https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80');\n";
  if (out.includes(defaultCover)) out = out.replace(defaultCover, "      setFormCoverImage('');\n      setFormCoverImageAssetId('');\n");

  const coverInput = "                        value={formCoverImage}\n                        onChange={(e) => setFormCoverImage(e.target.value)}\n";
  if (out.includes(coverInput)) out = out.replace(coverInput, "                        value={formCoverImage}\n                        onChange={(e) => { setFormCoverImage(e.target.value); setFormCoverImageAssetId(''); }}\n");

  if (!out.includes('coverImageAssetId: formCoverImageAssetId || undefined')) {
    const anchor = "            coverImage: finalCoverImage,\n";
    const count = out.split(anchor).length - 1;
    if (count < 1) throw new Error(`[media-linking] Expected at least one article cover save site, found ${count}`);
    out = out.replaceAll(anchor, anchor + "            coverImageAssetId: formCoverImageAssetId || undefined,\n");
  }

  if (!out.includes('const handleSelectMediaAsset = (asset: MediaAsset) => {')) {
    const anchor = "  // SAVE ARTICLE\n";
    if (!out.includes(anchor)) throw new Error('[media-linking] Save article anchor not found');
    const handler = [
      '  const handleSelectMediaAsset = (asset: MediaAsset) => {',
      "    if (!asset?.id || !asset.publicUrl) { alert('رسانه انتخاب‌شده معتبر نیست.'); return; }",
      '    setFormCoverImage(asset.publicUrl);',
      '    setFormCoverImageAssetId(asset.id);',
      '    setIsMediaPickerOpen(false);',
      '  };',
      '',
      '  const handleClearSelectedMediaAsset = () => {',
      "    setFormCoverImage('');",
      "    setFormCoverImageAssetId('');",
      '  };',
      ''
    ].join('\n');
    out = out.replace(anchor, handler + anchor);
  }

  if (!out.includes('id="media-article-picker"')) {
    const closeAnchor = "      </div>\n    </div>\n  );\n};";
    const insertAt = out.lastIndexOf(closeAnchor);
    if (insertAt < 0) throw new Error('[media-linking] Component close anchor not found');
    const picker = [
      '      {isMediaPickerOpen && (',
      '        <div id="media-article-picker" className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3" role="dialog" aria-modal="true">',
      '          <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl bg-slate-950 border border-slate-700 shadow-2xl flex flex-col">',
      '            <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3">',
      '              <div><h3 className="font-black text-white">انتخاب تصویر از کتابخانه رسانه</h3><p className="text-[11px] text-slate-400 mt-1">تصویر انتخاب‌شده به مقاله متصل می‌شود.</p></div>',
      '              <div className="flex items-center gap-2">',
      '                {formCoverImageAssetId && <button type="button" onClick={handleClearSelectedMediaAsset} className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[10px] font-bold">حذف انتخاب</button>}',
      '                <button type="button" onClick={() => setIsMediaPickerOpen(false)} className="p-2 rounded-xl bg-slate-900 text-slate-300 border border-slate-800"><X className="w-5 h-5" /></button>',
      '              </div>',
      '            </div>',
      '            <div className="p-3 border-b border-slate-800">',
      '              <input type="search" value={mediaSearchQuery} onChange={(e) => setMediaSearchQuery(e.target.value)} placeholder="جستجوی تصویر..." className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white" />',
      '            </div>',
      '            <div className="overflow-y-auto p-4">',
      '              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">',
      '                {githubMediaAssets.filter((asset) => { const q = mediaSearchQuery.trim().toLowerCase(); return !q || [asset.filename, asset.originalFilename, asset.title, asset.path].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)); }).map((asset) => (',
      '                  <button key={asset.id} type="button" onClick={() => handleSelectMediaAsset(asset)} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-right hover:border-emerald-400 transition-colors">',
      '                    <img src={asset.publicUrl} alt={asset.altText || asset.title || asset.filename} loading="lazy" className="w-full aspect-[16/10] object-cover" />',
      '                    <span className="block p-2 text-[10px] text-slate-300 truncate dir-ltr">{asset.filename}</span>',
      '                  </button>',
      '                ))}',
      '              </div>',
      '              {githubMediaAssets.length === 0 && <div className="py-12 text-center text-xs text-slate-500">کتابخانه رسانه خالی است.</div>}',
      '            </div>',
      '          </div>',
      '        </div>',
      '      )}',
      ''
    ].join('\n');
    out = out.slice(0, insertAt) + picker + out.slice(insertAt);
  }

  return out;
}, 'wire a stable production media picker to article cover assets');

console.log('✓ [media-linking] Fixed production media/article linking patch complete.');
