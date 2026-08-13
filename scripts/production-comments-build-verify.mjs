import fs from 'node:fs';

const file = 'src/components/AdminCmsModal.tsx';
if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);

const source = fs.readFileSync(file, 'utf8');
const requiredImport = "import { CommentsModerationPanel } from './CommentsModerationPanel';";
const requiredRender = "<CommentsModerationPanel articles={articles} />";

if (!source.includes(requiredImport)) {
  throw new Error('Production comments verification failed: AdminCmsModal is not wired to CommentsModerationPanel.');
}
if (!source.includes(requiredRender)) {
  throw new Error('Production comments verification failed: CommentsModerationPanel render was not found.');
}

const tabStart = source.indexOf('TAB 3: COMMENTS & TESTIMONIALS MODERATION');
const tabEnd = source.indexOf('TAB 4: GITHUB MEDIA MANAGEMENT', tabStart);
if (tabStart < 0 || tabEnd <= tabStart) {
  throw new Error('Production comments verification failed: moderation tab boundaries are missing.');
}
const tab = source.slice(tabStart, tabEnd);
if (!tab.includes(requiredRender)) {
  throw new Error('Production comments verification failed: moderation tab does not render the production panel.');
}

console.log('✓ Production comments moderation wiring verified.');
