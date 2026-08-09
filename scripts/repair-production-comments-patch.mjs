import fs from 'node:fs';

const filePath = new URL('./production-comments-patch.mjs', import.meta.url);
let source = fs.readFileSync(filePath, 'utf8');

const blockStart = source.indexOf('  const block = `');
const blockEnd = source.indexOf('`;\n\n  source = source.slice', blockStart);

if (blockStart < 0 || blockEnd < 0) {
  throw new Error('Production comments patch template block not found.');
}

const before = source.slice(blockStart, blockEnd);
const after = before.replace(/(?<!\\)\$\{/g, '\\${');

if (before !== after) {
  source = source.slice(0, blockStart) + after + source.slice(blockEnd);
  fs.writeFileSync(filePath, source, 'utf8');
  console.log('Production comments patch template escaping repaired.');
} else {
  console.log('Production comments patch template escaping already valid.');
}
