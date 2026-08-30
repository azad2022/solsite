import fs from 'node:fs';

const file = 'server.ts';
let source = fs.readFileSync(file, 'utf8');

const marker = '  // Legacy Redirect Map for Server-side 301 Redirects\n';
if (!source.includes(marker)) {
  throw new Error('Canonical host insertion marker not found; refusing to patch unknown source.');
}

const block = `  // Enforce one canonical hostname: https://solmint.ir (non-www).\n  // This prevents duplicate host variants from serving the same HTML and consolidates signals.\n  app.use((req, res, next) => {\n    const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim().toLowerCase();\n    const requestHost = String(forwardedHost || req.hostname || req.headers.host || '').trim().toLowerCase().split(':')[0];\n    if (requestHost === 'www.solmint.ir') {\n      return res.redirect(301, \`\\${SITE_DOMAIN}\\${req.originalUrl}\`);\n    }\n    next();\n  });\n\n`;

if (source.includes('Enforce one canonical hostname: https://solmint.ir')) {
  console.log('✓ Canonical host redirect already present.');
  process.exit(0);
}

source = source.replace(marker, block + marker);
fs.writeFileSync(file, source, 'utf8');
console.log('✓ Canonical host redirect enforced for www.solmint.ir → solmint.ir.');
