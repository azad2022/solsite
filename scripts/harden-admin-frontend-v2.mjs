import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'src/components/AdminCmsModal.tsx');
let source = readFileSync(file, 'utf8');

source = source.replace('const passHash = await hashPasscode(regPassword.trim());', 'const passHash = regPassword.trim();');
source = source.replace('const regRes = await registerUserApi({\n      username: cleanUsername,\n      fullName: cleanFullName,\n      passwordHash: passHash,', 'const regRes = await registerUserApi({\n      username: cleanUsername,\n      fullName: cleanFullName,\n      password: passHash,');
source = source.replace('passHash = await hashPasscode(memberPassword.trim());', 'passHash = memberPassword.trim();');
source = source.replace('...(passHash ? { passwordHash: passHash } : {})', '...(passHash ? { password: passHash } : {})');

if (source.includes('hashPasscode(')) {
  throw new Error('Legacy client-side password hashing remains in AdminCmsModal.tsx');
}

writeFileSync(file, source, 'utf8');
console.log('✓ AdminCmsModal hardened: plaintext password is sent only to server HTTPS endpoint; client-side hashing removed.');
