import fs from 'node:fs';

const file = 'src/components/AdminCmsModal.tsx';
let source = fs.readFileSync(file, 'utf8');

const importLine = "import { MediaCategoryDefaultPicker } from './MediaCategoryDefaultPicker';";
if (!source.includes(importLine)) {
  const anchor = "import { ProArticleEditor } from './ProArticleEditor';\n";
  if (!source.includes(anchor)) throw new Error('[media-picker] import anchor not found');
  source = source.replace(anchor, `${anchor}${importLine}\n`);
}

if (!source.includes('const [categoryDefaultAsset, setCategoryDefaultAsset]')) {
  const anchor = "  const [formCoverImageAssetId, setFormCoverImageAssetId] = useState<string>('');\n";
  if (!source.includes(anchor)) throw new Error('[media-picker] state anchor not found');
  source = source.replace(anchor, `${anchor}  const [categoryDefaultAsset, setCategoryDefaultAsset] = useState<MediaAsset | null>(null);\n`);
}

const oldImageContainer = `                                  <div className="relative group rounded-xl overflow-hidden bg-slate-950 border border-slate-800 h-36 flex items-center justify-center">\n                                    <img `;
const newImageContainer = `                                  <button type="button" onClick={() => setCategoryDefaultAsset(asset)} className="relative group rounded-xl overflow-hidden bg-slate-950 border border-slate-800 h-36 flex items-center justify-center w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/60" title="انتخاب این تصویر به‌عنوان تصویر پیش‌فرض دسته‌بندی">\n                                    <span className="absolute bottom-2 right-2 z-10 bg-purple-600/90 text-white text-[9px] font-extrabold px-2 py-1 rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity">انتخاب تصویر پیش‌فرض</span>\n                                    <img `;
if (!source.includes('title="انتخاب این تصویر به‌عنوان تصویر پیش‌فرض دسته‌بندی"')) {
  if (!source.includes(oldImageContainer)) throw new Error('[media-picker] image container anchor not found');
  source = source.replace(oldImageContainer, newImageContainer);

  const imageContainerClose = `                                  </div>\n\n                                  {/* Asset Info */}`;
  const buttonContainerClose = `                                  </button>\n\n                                  {/* Asset Info */}`;
  if (!source.includes(imageContainerClose)) throw new Error('[media-picker] image container closing marker not found');
  source = source.replace(imageContainerClose, buttonContainerClose);
}

if (!source.includes('<MediaCategoryDefaultPicker asset={asset}')) {
  const actionMarker = `                                  {/* Actions */}\n`;
  const picker = `                                  {categoryDefaultAsset?.id === asset.id && (\n                                    <MediaCategoryDefaultPicker\n                                      asset={asset}\n                                      onClose={() => setCategoryDefaultAsset(null)}\n                                    />\n                                  )}\n\n`;
  if (!source.includes(actionMarker)) throw new Error('[media-picker] actions marker not found');
  source = source.replace(actionMarker, picker + actionMarker);
}

fs.writeFileSync(file, source, 'utf8');
console.log('✓ [media-picker] existing media thumbnails now open the category default picker.');
