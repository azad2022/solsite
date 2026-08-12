import fs from 'node:fs';

const root = process.cwd();
const filePath = `${root}/src/components/AdminCmsModal.tsx`;

if (!fs.existsSync(filePath)) throw new Error(`Missing ${filePath}`);

let source = fs.readFileSync(filePath, 'utf8');
const original = source;

if (!source.includes("import { CommentsModerationPanel } from './CommentsModerationPanel';")) {
  const anchor = "import { ProArticleEditor } from './ProArticleEditor';";
  if (!source.includes(anchor)) throw new Error('AdminCmsModal import anchor not found');
  source = source.replace(anchor, `${anchor}\nimport { CommentsModerationPanel } from './CommentsModerationPanel';`);
}

const startMarker = '            {/* TAB 3: COMMENTS & TESTIMONIALS MODERATION */}';
const nextMarker = '            {/* TAB 4: GITHUB MEDIA MANAGEMENT */}';
const start = source.indexOf(startMarker);
const end = source.indexOf(nextMarker, start);
if (start < 0 || end < 0 || end <= start) throw new Error('Comments moderation markers not found');

const replacement = `${startMarker}\n            {adminTab === 'comments' && (\n              <CommentsModerationPanel articles={articles} />\n            )}\n\n`;
source = source.slice(0, start) + replacement + source.slice(end);

if (source !== original) {
  fs.writeFileSync(filePath, source, 'utf8');
  console.log('Production comments admin panel patch applied.');
} else {
  console.log('Production comments admin panel already up to date.');
}
