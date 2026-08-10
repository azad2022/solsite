import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'src/components/AdminCmsModal.tsx');
let source = readFileSync(file, 'utf8');

const replaceRequired = (regex, replacement, label) => {
  const next = source.replace(regex, replacement);
  if (next === source) throw new Error('Frontend auth hardening failed: ' + label);
  source = next;
};

// Remove client-side password hash state/helpers and browser-persisted authentication state.
source = source.replace(/^\s*const \[storedPassHash, setStoredPassHash\] = useState\(''\);\s*$/m, '');
source = source.replace(/^\s*safeSetLocalStorage\('solmint_(?:users|current_user)'[^;]*\);\s*$/gm, '');
source = source.replace(/^\s*localStorage\.(?:getItem|setItem|removeItem)\('solmint_(?:admin_passcode|admin_pass_hash|admin_session|current_user|users)'[^;]*\);\s*$/gm, '');

// Registration is server-authoritative. No fabricated local user is permitted.
const registrationReplacement = [
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
replaceRequired(/  const handleRegister = async \(e: React\.FormEvent\) => \{[\s\S]*?\n  \};\n\n  const handleLogout/, registrationReplacement + '  const handleLogout', 'server-only registration');

// User-management operations are server-authoritative and never fabricate local accounts.
const memberReplacement = [
  '  const handleSaveMember = async (e: React.FormEvent) => {',
  '    e.preventDefault();',
  '    const cleanName = sanitizeText(memberFullName);',
  '    const cleanUser = sanitizeText(memberUsername);',
  "    if (!cleanName || !cleanUser) { alert('لطفا نام و نام کاربری را وارد کنید.'); return; }",
  "    if (!editingUserId && !memberPassword.trim()) { alert('لطفا رمز عبور کاربر جدید را مشخص کنید.'); return; }",
  '    if (editingUserId) {',
  '      const ok = await updateUserApi({',
  '        userId: editingUserId,',
  '        role: memberRole,',
  '        permissions: memberPermissions,',
  '        isActive: memberIsActive,',
  '        ...(memberPassword.trim() ? { password: memberPassword.trim() } : {})',
  '      });',
  '      if (!ok) { alert(\'ذخیره تغییرات کاربر در سرور انجام نشد.\'); return; }',
  '      setUsers(await fetchUsersApi());',
  '      setUserManagementNotice(\'اطلاعات و دسترسی‌های کاربر با موفقیت در سرور به‌روزرسانی شد.\');',
  '    } else {',
  '      const regRes = await registerUserApi({',
  '        username: cleanUser,',
  '        fullName: cleanName,',
  '        password: memberPassword.trim(),',
  '        role: memberRole,',
  '        permissions: memberPermissions,',
  '        isActive: memberIsActive',
  '      });',
  "      if (!regRes.success || !regRes.user) { alert(regRes.message || 'ایجاد کاربر در سرور انجام نشد.'); return; }",
  '      setUsers(await fetchUsersApi());',
  '      setUserManagementNotice(\'نویسنده/همکار جدید با موفقیت در سرور اضافه شد.\');',
  '    }',
  '    setEditingUserId(null);',
  "    setMemberFullName('');",
  "    setMemberUsername('');",
  "    setMemberPassword('');",
  "    setMemberRole('writer');",
  "    setMemberPermissions(['articles', 'editor', 'comments', 'media']);",
  '    setShowAddMemberForm(false);',
  '  };',
  '',
].join('\n');
replaceRequired(/  const handleSaveMember = async \(e: React\.FormEvent\) => \{[\s\S]*?\n  const handleEditUserClick/, memberReplacement + '  const handleEditUserClick', 'server-only user management');

const mutationReplacement = [
  '  const handleToggleUserActive = async (userId: string) => {',
  '    const target = users.find(u => u.id === userId);',
  '    if (!target) return;',
  '    const ok = await updateUserApi({ userId, isActive: !(target.isActive !== false) });',
  "    if (!ok) { alert('تغییر وضعیت کاربر در سرور انجام نشد.'); return; }",
  '    setUsers(await fetchUsersApi());',
  '  };',
  '',
  '  const handleDeleteUser = async (userId: string) => {',
  "    if (!confirm('آیا از حذف این کاربر اطمینان دارید؟')) return;",
  '    const ok = await deleteUserApi(userId);',
  "    if (!ok) { alert('حذف کاربر از سرور انجام نشد.'); return; }",
  '    setUsers(await fetchUsersApi());',
  '  };',
  ''
].join('\n');
replaceRequired(/  const handleToggleUserActive[\s\S]*?\n  const handleTogglePermission/, mutationReplacement + '  const handleTogglePermission', 'server-only user mutations');

// Authentication state is server-owned. Fail the build if forbidden legacy authentication remains.
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
  "passwordHash: passHash"
];
const remaining = forbidden.filter(token => source.includes(token));
if (remaining.length) {
  throw new Error('Frontend auth hardening failed; legacy authentication remains: ' + remaining.join(', '));
}

writeFileSync(file, source, 'utf8');
console.log('✓ AdminCmsModal authentication hardened: server session only; no client hashing, local auth persistence, or fabricated accounts.');
