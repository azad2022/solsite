import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'src/components/AdminCmsModal.tsx');
const source = fs.readFileSync(file, 'utf8');

const importMarker = "import { SolanaLogoIcon } from './Header';";
const iconImportNeedle = "  Activity,\n";

let next = source.replace(importMarker, '');
if (!next.includes('import {')) throw new Error('AdminCmsModal imports were unexpectedly malformed.');
if (!next.includes('CircleDollarSign')) {
  next = next.replace(iconImportNeedle, `${iconImportNeedle}  CircleDollarSign,\n`);
}
next = next.replace(/<SolanaLogoIcon\s+className=\"w-full h-full\"\s*\/>/g, '<CircleDollarSign className="w-full h-full" aria-hidden="true" />');

if (next === source) {
  if (source.includes('SolanaLogoIcon')) throw new Error('Stale SolanaLogoIcon reference remains in AdminCmsModal.tsx.');
  console.log('Admin Solana logo import already repaired.');
  process.exit(0);
}

fs.writeFileSync(file, next, 'utf8');
if (next.includes('SolanaLogoIcon')) throw new Error('Stale SolanaLogoIcon reference remains after repair.');
console.log('✓ AdminCmsModal stale SolanaLogoIcon import repaired.');
