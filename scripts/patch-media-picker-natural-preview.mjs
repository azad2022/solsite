import fs from 'node:fs';

const file = 'src/components/MediaCategoryDefaultPicker.tsx';
let source = fs.readFileSync(file, 'utf8');
const importAnchor = "import { MediaAsset } from '../types';";
const importLine = "import { MediaAssetNaturalPreview } from './MediaAssetNaturalPreview';";
if (!source.includes(importLine)) {
  if (!source.includes(importAnchor)) throw new Error('[media-picker-preview] import anchor not found');
  source = source.replace(importAnchor, `${importAnchor}\n${importLine}`);
}
const old = '<div className="w-full max-h-[24rem] rounded-2xl border border-slate-800 bg-black/30 overflow-hidden flex items-center justify-center p-2"><img src={previewAssets[0].publicUrl} alt={previewAssets[0].altText || previewAssets[0].filename} className="max-w-full max-h-[23rem] w-auto h-auto object-contain" /></div>';
const replacement = '<MediaAssetNaturalPreview src={previewAssets[0].publicUrl} alt={previewAssets[0].altText || previewAssets[0].filename} />';
if (!source.includes(replacement)) {
  if (!source.includes(old)) throw new Error('[media-picker-preview] preview marker not found');
  source = source.replace(old, replacement);
}
fs.writeFileSync(file, source, 'utf8');
console.log('✓ [media-picker-preview] admin preview now follows the image natural aspect ratio.');
