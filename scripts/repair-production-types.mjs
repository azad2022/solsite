import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function write(file, content) {
  fs.writeFileSync(path.join(root, file), content, 'utf8');
}

function replaceOnce(file, source, search, replacement, label) {
  if (!source.includes(search)) {
    if (source.includes(replacement)) return source;
    throw new Error(`Expected source pattern not found for ${label} in ${file}`);
  }
  return source.replace(search, replacement);
}

let changed = [];

// Admin CMS: the UI already exposes audit/redirect tabs, so the state should use
// the same AdminPermission union instead of a narrower stale literal union.
{
  const file = 'src/components/AdminCmsModal.tsx';
  let source = read(file);
  const before = source;

  source = replaceOnce(
    file,
    source,
    "const [adminTab, setAdminTab] = useState<'articles' | 'editor' | 'comments' | 'media' | 'seo' | 'downloads' | 'deepseek' | 'chatbot' | 'security' | 'database' | 'users'>('articles');",
    "const [adminTab, setAdminTab] = useState<AdminPermission>('articles');",
    'admin tab state type'
  );

  source = replaceOnce(
    file,
    source,
    "useState<'آموزش سولانا' | 'توسعه وب۳' | 'امنیت' | 'اخبار و تحلیل'>('آموزش سولانا')",
    "useState<Article['category']>('آموزش سولانا')",
    'article category state type'
  );

  // One navigation helper receives a string from a known permission-driven menu.
  source = source.replace(/setAdminTab\(tab\)/g, 'setAdminTab(tab as AdminPermission)');

  // MediaAsset's canonical field is publicUrl; keep the runtime behavior aligned
  // with the shared model instead of weakening the model with a fake url alias.
  source = source.replace(/asset\.url/g, 'asset.publicUrl');

  if (source !== before) {
    write(file, source);
    changed.push(file);
  }
}

// Moderation comments are keyed to articles in the production moderation UI.
{
  const file = 'src/components/CommentsModerationPanel.tsx';
  let source = read(file);
  const before = source;
  const marker = 'interface ModerationComment {\n';
  if (source.includes(marker) && !source.includes('  articleId?: string;')) {
    source = source.replace(marker, `${marker}  articleId?: string;\n`);
  }
  if (source !== before) {
    write(file, source);
    changed.push(file);
  }
}

// DownloadLinks was renamed to the canonical apkUrl/telegramUrl fields.
// Update the consumer instead of carrying obsolete duplicate type fields.
{
  const file = 'src/components/landing/LandingPages.tsx';
  let source = read(file);
  const before = source;
  source = source.replace(/downloadLinks\.directApkUrl/g, 'downloadLinks.apkUrl');
  source = source.replace(/downloadLinks\.telegramChannelUrl/g, 'downloadLinks.telegramUrl');
  if (source !== before) {
    write(file, source);
    changed.push(file);
  }
}

console.log(changed.length ? `Repaired type mismatches in: ${changed.join(', ')}` : 'No production type repairs were needed.');
