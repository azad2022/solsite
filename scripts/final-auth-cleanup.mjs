import { readFileSync, writeFileSync } from 'node:fs';

const file = 'src/components/AdminCmsModal.tsx';
let source = readFileSync(file, 'utf8');

source = source.replace(/^\s*const \[storedPassHash, setStoredPassHash\] = useState\(''\);\s*$/m, '');
source = source.replace(/^\s*setStoredPassHash\(''\);\s*$/gm, '');
source = source.replace(/^\s*safeSetLocalStorage\('solmint_(?:users|current_user)'[^;]*\);\s*$/gm, '');
source = source.replace(/^\s*localStorage\.(?:getItem|setItem|removeItem)\('solmint_(?:admin_passcode|admin_pass_hash|admin_session|current_user|users)'[^;]*\);\s*$/gm, '');

const forbidden = [
  'hashPasscode(',
  'DEFAULT_PASSCODE_HASH',
  'solmint_admin_passcode',
  'solmint_admin_pass_hash',
  'solmint_admin_session',
  'solmint_current_user',
  "safeSetLocalStorage('solmint_users'",
  "localStorage.setItem('solmint_users'",
  'passwordHash: passHash',
  'passwordHash: activeHash',
  'setStoredPassHash('
];

const remaining = forbidden.filter(token => source.includes(token));
if (remaining.length) throw new Error('Final frontend authentication cleanup failed: ' + remaining.join(', '));

writeFileSync(file, source, 'utf8');
console.log('✓ Final frontend authentication cleanup passed.');
