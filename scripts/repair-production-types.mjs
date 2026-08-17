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

// Admin CMS: keep the tab state aligned with the shared AdminPermission union.
{
  const file = 'src/components/AdminCmsModal.tsx';
  let source = read(file);
  const before = source;

  const adminTabPattern = /const \[adminTab, setAdminTab\] = useState<[^;]+>\('articles'\);/;
  const adminTabReplacement = "const [adminTab, setAdminTab] = useState<AdminPermission>('articles');";
  if (adminTabPattern.test(source)) {
    source = source.replace(adminTabPattern, adminTabReplacement);
  }

  source = source.replace(/setAdminTab\(tab\)/g, 'setAdminTab(tab as AdminPermission)');
  source = source.replace(/asset\.url/g, 'asset.publicUrl');

  if (source !== before) {
    write(file, source);
    changed.push(file);
  }
}

// Moderation comments are keyed to articles in the production moderation UI.
// The shared moderation-comment type lives in cmsApiClient.ts, so repair it there.
{
  const file = 'src/utils/cmsApiClient.ts';
  let source = read(file);
  const before = source;

  if (source.includes('export interface ModerationComment extends ArticleComment {') && !source.includes('  articleId?: string;')) {
    source = source.replace(
      'export interface ModerationComment extends ArticleComment {\n',
      'export interface ModerationComment extends ArticleComment {\n  articleId?: string;\n'
    );
  }

  if (source !== before) {
    write(file, source);
    changed.push(file);
  }
}

// DownloadLinks uses the canonical apkUrl/telegramUrl fields.
{
  const file = 'src/components/landing/LandingPages.tsx';
  let source = read(file);
  const before = source;
  source = source.replace(/downloadLinks\?\.directApkUrl/g, 'downloadLinks?.apkUrl');
  source = source.replace(/downloadLinks\?\.telegramChannelUrl/g, 'downloadLinks?.telegramUrl');
  source = source.replace(/downloadLinks\.directApkUrl/g, 'downloadLinks.apkUrl');
  source = source.replace(/downloadLinks\.telegramChannelUrl/g, 'downloadLinks.telegramUrl');
  if (source !== before) {
    write(file, source);
    changed.push(file);
  }
}

// Wallet Analyzer: accept the readonly tuples produced by the RPC method table.
{
  const file = 'functions/api/wallet/analyze.ts';
  let source = read(file);
  const before = source;
  source = source.replace(
    'async function rpcCall(env: Env, method: string, params: unknown[]): Promise<unknown> {',
    'async function rpcCall(env: Env, method: string, params: readonly unknown[]): Promise<unknown> {'
  );
  if (source !== before) {
    write(file, source);
    changed.push(file);
  }
}

console.log(changed.length ? `Repaired type mismatches in: ${changed.join(', ')}` : 'No production type repairs were needed.');
