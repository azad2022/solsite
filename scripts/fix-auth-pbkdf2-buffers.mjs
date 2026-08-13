import fs from 'node:fs';

const target = 'functions/api/auth/_shared.ts';
const source = fs.readFileSync(target, 'utf8');
const needle = '      salt: hexToBytes(saltHex),';
const replacement = '      salt: hexToBytes(saltHex).buffer as ArrayBuffer,';

if (source.includes(replacement)) {
  console.log('✓ PBKDF2 salt BufferSource typing already normalized.');
  process.exit(0);
}

if (!source.includes(needle)) {
  throw new Error('Auth PBKDF2 patch failed: salt expression marker not found.');
}

fs.writeFileSync(target, source.replace(needle, replacement), 'utf8');
console.log('✓ PBKDF2 salt BufferSource typing normalized for TypeScript.');
