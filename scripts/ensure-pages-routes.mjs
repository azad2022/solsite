import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const sourcePath = path.join(projectRoot, 'public', '_routes.json');
const distDir = path.join(projectRoot, 'dist');
const outputPath = path.join(distDir, '_routes.json');

if (!fs.existsSync(sourcePath)) {
  throw new Error('[pages-routes] public/_routes.json is missing.');
}

let parsed;
try {
  parsed = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
} catch (error) {
  throw new Error('[pages-routes] public/_routes.json is not valid JSON.');
}

if (
  !parsed ||
  parsed.version !== 1 ||
  !Array.isArray(parsed.include) ||
  !Array.isArray(parsed.exclude) ||
  !parsed.include.includes('/r/*')
) {
  throw new Error('[pages-routes] _routes.json must use schema v1 and explicitly include /r/*.');
}

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2) + '\n', 'utf8');

const emitted = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
if (!emitted.include.includes('/r/*')) {
  throw new Error('[pages-routes] dist/_routes.json does not contain /r/*.');
}

console.log('✓ Pages routing manifest emitted to dist/_routes.json with /r/* included.');
