import fs from 'node:fs';

const target = 'functions/api/auth/_shared.ts';
const source = fs.readFileSync(target, 'utf8');
const normalized = 'const salt = new Uint8Array(hexToBytes(saltHex)).buffer as ArrayBuffer;';
const legacyNeedle = '      salt: hexToBytes(saltHex),';
const legacyReplacement = '      salt: hexToBytes(saltHex).buffer as ArrayBuffer,';

if (source.includes(normalized) || source.includes(legacyReplacement)) {
  console.log('✓ PBKDF2 salt BufferSource typing already normalized.');
  process.exit(0);
}

if (source.includes(legacyNeedle)) {
  fs.writeFileSync(target, source.replace(legacyNeedle, legacyReplacement), 'utf8');
  console.log('✓ PBKDF2 salt BufferSource typing normalized for TypeScript.');
  process.exit(0);
}

throw new Error('Auth PBKDF2 patch failed: no supported salt expression marker found.');
