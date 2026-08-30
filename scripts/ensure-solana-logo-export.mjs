import fs from 'node:fs';

const file = 'src/components/Header.tsx';
const source = fs.readFileSync(file, 'utf8');

if (source.includes('export const SolanaLogoIcon')) {
  console.log('✓ SolanaLogoIcon export already present.');
  process.exit(0);
}

const marker = "import { HeaderMarketTicker } from './HeaderMarketTicker';\n";
if (!source.includes(marker)) {
  throw new Error('Header import marker not found; refusing to patch unknown source.');
}

const exportBlock = `\nexport const SolanaLogoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (\n  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>\n    <path d="M5 5.2A2 2 0 0 1 6.74 4h11.79a1.5 1.5 0 0 1 1.06 2.56l-2.2 2.2a1.5 1.5 0 0 1-1.06.44H4.54a1.5 1.5 0 0 1-1.06-2.56l1.52-1.44Z" fill="currentColor" />\n    <path d="M5.67 9.8h13.79a1.5 1.5 0 0 1 1.06 2.56L19 13.88a1.5 1.5 0 0 1-1.06.44H4.25a1.5 1.5 0 0 1-1.06-2.56l1.42-1.52a1.5 1.5 0 0 1 1.06-.44Z" fill="currentColor" opacity=".8" />\n    <path d="M5 15.76h13.25a1.5 1.5 0 0 1 1.06 2.56l-1.52 1.44A2 2 0 0 1 16.41 20H4.62a1.5 1.5 0 0 1-1.06-2.56l.38-.38A1.5 1.5 0 0 1 5 15.76Z" fill="currentColor" opacity=".6" />\n  </svg>\n);\n`;

fs.writeFileSync(file, source.replace(marker, `${marker}${exportBlock}`), 'utf8');
console.log('✓ Restored SolanaLogoIcon export for build compatibility.');
