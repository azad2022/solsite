import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'src/components/AdminCmsModal.tsx');
let source = readFileSync(file, 'utf8');

const serverRegistration = [
  '  // REGISTER NEW REAL USER ACCOUNT - SERVER AUTHORITATIVE',
  '  const handleRegister = async (e: React.FormEvent) => {',
  '    e.preventDefault();',
  '    const cleanFullName = sanitizeText(regFullName);',
  '    const cleanUsername = sanitizeText(regUsername);',
  '    if (!cleanFullName || !cleanUsername || !regPassword.trim()) {',
  "      alert('لطفا تمامی فیلدها را به دقت تکمیل نمایید.');",
  '      return;',
  '    }',
  '    const usernameVal = validateUsername(cleanUsername);',
  '    if (!usernameVal.valid) { alert(usernameVal.error); return; }',
  '    const passVal = validatePassword(regPassword);',
  '    if (!passVal.valid) { alert(passVal.error); return; }',
  '    if (regPassword !== regConfirmPassword) {',
  "      alert('رمز عبور و تکرار آن مطابقت ندارند.');",
  '      return;',
  '    }',
  '    const regRes = await registerUserApi({',
  '      username: cleanUsername,',
  '      fullName: cleanFullName,',
  '      password: regPassword.trim(),',
  "      role: 'user'",
  '    });',
  '    if (!regRes.success || !regRes.user) {',
  "      alert(regRes.message || 'ثبت‌نام در سرور انجام نشد.');",
  '      return;',
  '    }',
  '    setUsers(prev => [regRes.user!, ...prev.filter(u => u.id !== regRes.user!.id)]);',
  '    setCurrentUser(regRes.user);',
  '    setIsAuthenticated(true);',
  "    setRegFullName('');",
  "    setRegUsername('');",
  "    setRegPassword('');",
  "    setRegConfirmPassword('');",
  "    alert('ثبت‌نام حساب کاربری با موفقیت در سرور انجام شد.');",
  '  };',
  ''
].join('\n');

const registerRegex = /  \/\/ REGISTER NEW REAL USER ACCOUNT[\s\S]*?\n  const handleLogout/;
if (registerRegex.test(source)) {
  source = source.replace(registerRegex, serverRegistration + '  const handleLogout');
}

// Remove any remaining client-side password hash state/helper references.
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
if (remaining.length) throw new Error('Frontend auth hardening failed: ' + remaining.join(', '));

writeFileSync(file, source, 'utf8');
console.log('✓ Frontend authentication hardening passed.');
