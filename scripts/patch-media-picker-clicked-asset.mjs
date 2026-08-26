import fs from 'node:fs';

const file = 'src/components/MediaCategoryDefaultPicker.tsx';
let source = fs.readFileSync(file, 'utf8');
const initialOld = "setSelectedIds((match?.media_assets || []).map(media => media.id));";
const initialNew = "setSelectedIds(Array.from(new Set([...(match?.media_assets || []).map(media => media.id), asset.id])));";
if (source.includes(initialOld)) source = source.replace(initialOld, initialNew);
const switchOld = "setSelectedIds((category.media_assets || []).map(media => media.id));";
const switchNew = "setSelectedIds(Array.from(new Set([...(category.media_assets || []).map(media => media.id), asset?.id].filter(Boolean) as string[])));";
if (source.includes(switchOld)) source = source.replace(switchOld, switchNew);
if (!source.includes(initialNew)) throw new Error('[media-picker-click] initial selection marker not found');
if (!source.includes(switchNew)) throw new Error('[media-picker-click] category selection marker not found');
fs.writeFileSync(file, source, 'utf8');
console.log('✓ [media-picker-click] clicked asset is preselected for the chosen category.');
