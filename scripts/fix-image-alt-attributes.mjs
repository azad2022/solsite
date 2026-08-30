import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const targets = [
  path.join(repoRoot, 'src/components/Header.tsx'),
  path.join(repoRoot, 'src/components/HeaderMarketTicker.tsx'),
];

function updateFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let next = original;

  next = next.replace(
    /<img src="\/assets\/solmint-mascot-solana-coin\.webp\?v=2" alt="" aria-hidden="true"/,
    '<img src="/assets/solmint-mascot-solana-coin.webp?v=2" alt="لوگوی سولمینت"'
  );

  next = next.replace(
    /<img src=\{logo\} alt="" aria-hidden="true" width=\{22\} height=\{22\}/,
    '<img src={logo} alt={`${symbol} logo`} width={22} height={22}'
  );

  if (next !== original) {
    fs.writeFileSync(filePath, next);
    return true;
  }
  return false;
}

let changed = 0;
for (const file of targets) {
  if (updateFile(file)) changed += 1;
}

const header = fs.readFileSync(targets[0], 'utf8');
const ticker = fs.readFileSync(targets[1], 'utf8');

if (!header.includes('alt="لوگوی سولمینت"')) {
  throw new Error('Header mascot alt attribute was not applied.');
}
if (header.includes('solmint-mascot-solana-coin.webp?v=2" alt=""')) {
  throw new Error('Header mascot still has an empty alt attribute.');
}
if (!ticker.includes('alt={`${symbol} logo`}')) {
  throw new Error('Ticker logo alt attribute was not applied.');
}
if (ticker.includes('alt="" aria-hidden="true" width={22}')) {
  throw new Error('Ticker logos still use empty alt with aria-hidden.');
}

console.log(`✓ Image alt hardening verified (${changed} source file${changed === 1 ? '' : 's'} updated).`);
