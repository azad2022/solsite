import fs from 'node:fs';

const file = 'src/utils/seoManager.ts';
const source = fs.readFileSync(file, 'utf8');

const routePattern = /(\n  '\\/': \{)[\s\S]*?(\n  \},\n  '\\/solana-wallet': \{)/;
const match = source.match(routePattern);
if (!match) throw new Error('Homepage SEO route block was not found.');

const expected = [
  "  '/': {",
  '    path: \'/\',',
  "    title: 'سولمینت | کیف پول غیرامانی سولانا و ابزارهای Web3',",
  "    description: 'سولمینت یک کیف پول غیرامانی سولانا برای اندروید و پلتفرم Web3 است؛ مدیریت SOL و توکن‌ها، ساخت توکن SPL و میم‌کوین، NFT، Swap و ابزارهای تخصصی Solana.',",
  '    canonical: `${SITE_DOMAIN}/`,',
  "    ogType: 'website',",
  "    ogImage: `${SITE_DOMAIN}/og-solmint.png`,",
  "    h1: 'کیف پول غیرامانی سولانا و ابزارهای Web3',",
  "    breadcrumbs: [{ name: 'خانه', url: `${SITE_DOMAIN}/` }]",
  '  }',
].join('\n');

const next = source.replace(routePattern, `\n${expected}${match[2]}`);

if (next !== source) {
  fs.writeFileSync(file, next, 'utf8');
  console.log('✓ Homepage SEO route metadata normalized.');
} else {
  console.log('✓ Homepage SEO route metadata already normalized.');
}
