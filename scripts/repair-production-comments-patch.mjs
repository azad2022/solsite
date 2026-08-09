import fs from 'node:fs';

const filePath = new URL('./production-comments-patch.mjs', import.meta.url);
let source = fs.readFileSync(filePath, 'utf8');

// The generated server code must preserve backslashes in regex literals and string escapes.
// String.raw keeps those sequences intact while the repair below keeps nested ${...}
// expressions from being evaluated by the outer build-time template.
const blockMarker = '  const block = `';
const rawBlockMarker = '  const block = String.raw`';
const blockStart = source.includes(rawBlockMarker) ? source.indexOf(rawBlockMarker) : source.indexOf(blockMarker);
const blockEnd = source.indexOf('`;\n\n  source = source.slice', blockStart);

if (blockStart < 0 || blockEnd < 0) {
  throw new Error('Production comments patch template block not found.');
}

let changed = false;
if (!source.includes(rawBlockMarker)) {
  source = source.slice(0, blockStart) + rawBlockMarker + source.slice(blockStart + blockMarker.length);
  changed = true;
}

const currentStart = source.indexOf(rawBlockMarker);
const currentEnd = source.indexOf('`;\n\n  source = source.slice', currentStart);
const before = source.slice(currentStart, currentEnd);
const after = before.replace(/(?<!\\)\$\{/g, '\\${');

if (before !== after) {
  source = source.slice(0, currentStart) + after + source.slice(currentEnd);
  changed = true;
}

if (changed) {
  fs.writeFileSync(filePath, source, 'utf8');
  console.log('Production comments patch template escaping repaired.');
} else {
  console.log('Production comments patch template escaping already valid.');
}
