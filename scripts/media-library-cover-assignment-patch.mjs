import fs from 'node:fs';

const file = 'src/components/AdminCmsModal.tsx';
let source = fs.readFileSync(file, 'utf8');

const importLine = "import { MediaLibraryCoverAssignment } from './MediaLibraryCoverAssignment';";
if (!source.includes(importLine)) {
  const anchor = "import { ProArticleEditor } from './ProArticleEditor';\n";
  if (!source.includes(anchor)) throw new Error('[media-cover] AdminCmsModal import anchor not found');
  source = source.replace(anchor, `${anchor}${importLine}\n`);
}

if (!source.includes('<MediaLibraryCoverAssignment />')) {
  const marker = "                {mediaSubTab === 'library' && (\n                  <div className=\"space-y-4\">";
  if (!source.includes(marker)) throw new Error('[media-cover] media library render marker not found');
  source = source.replace(marker, `                <MediaLibraryCoverAssignment />\n\n${marker}`);
}

fs.writeFileSync(file, source, 'utf8');
console.log('✓ [media-cover] mounted image-to-category default-cover assignment inside the real media library tab.');
