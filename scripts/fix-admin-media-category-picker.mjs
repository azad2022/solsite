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
  // Keep this patch anchored to the stable media-card structure instead of the
  // mutable Actions section. The Actions marker changed in the current CMS,
  // which previously caused production builds to fail after earlier transforms.
  const stableMarker = `                                  {/* Asset Info */}\n`;
  const picker = `                                  {categoryDefaultAsset?.id === asset.id && (\n                                    <MediaCategoryDefaultPicker\n                                      asset={asset}\n                                      onClose={() => setCategoryDefaultAsset(null)}\n                                    />\n                                  )}\n\n`;
  if (!source.includes(stableMarker)) throw new Error('[media-picker] stable asset-info marker not found');
  source = source.replace(stableMarker, picker + stableMarker);
}

const headerFile = 'src/components/Header.tsx';
let headerSource = fs.readFileSync(headerFile, 'utf8');
if (!headerSource.includes('export const SolanaLogoIcon')) {
  const exportShim = `\nexport const SolanaLogoIcon: React.FC<{ className?: string }> = ({ className = 'h-5 w-5' }) => (\n  <img\n    src="/assets/solmint-mascot-solana-coin.webp?v=2"\n    alt=""\n    aria-hidden="true"\n    className={className}\n    decoding="async"\n  />\n);\n`;
  const anchor = "import { HeaderMarketTicker } from './HeaderMarketTicker';\n";
  if (!headerSource.includes(anchor)) throw new Error('[header-export] import anchor not found');
  headerSource = headerSource.replace(anchor, `${anchor}${exportShim}`);
  fs.writeFileSync(headerFile, headerSource, 'utf8');
}

fs.writeFileSync(file, source, 'utf8');
console.log('✓ [media-picker] existing media thumbnails now open the category default picker.');
console.log('✓ [header-export] restored SolanaLogoIcon export without restoring the legacy Solana mark.');
