import fs from 'fs';

const path = 'src/components/AdminCmsModal.tsx';
let text = fs.readFileSync(path, 'utf8');

function replace(re, value, label) {
  const next = text.replace(re, value);
  if (next === text) throw new Error(`Frontend auth hardening failed: ${label}`);
  text = next;
}

// Remove all client-side password hashing and embedded/default credentials.
text = text.replace(/\/\/ SHA-256 helper for client-side password hashing[\s\S]*?const DEFAULT_PASSCODE_HASH = '[^']+';\n\n/, '');
text = text.replace(/const \[storedPassHash, setStoredPassHash\] = useState\([^;]*\);\n\n?/, '');

// Authentication state must originate from the server session only.
text = text.replace(/const \[users, setUsers\] = useState<UserAccount\[\]>\(\(\) => \{[\s\S]*?\}\);/, 'const [users, setUsers] = useState<UserAccount[]>([]);');
text = text.replace(/const \[isAuthenticated, setIsAuthenticated\] = useState\([^;]*\);/, 'const [isAuthenticated, setIsAuthenticated] = useState(Boolean(currentUser));');

// Never persist the server user list or authentication state in browser storage.
text = text.replace(/\s*try \{\s*localStorage\.setItem\('solmint_users',[\s\S]*?\} catch \(e\) \{\}\s*/, '\n');
text = text.replace(/\s*safeSetLocalStorage\('solmint_users',[^;]*\);/g, '');
text = text.replace(/\s*localStorage\.setItem\('solmint_users',[^;]*\);/g, '');
text = text.replace(/\s*safeSetLocalStorage\('solmint_current_user',[^;]*\);/g, '');
text = text.replace(/\s*localStorage\.setItem\('solmint_current_user',[^;]*\);/g, '');
text = text.replace(/\s*localStorage\.(?:getItem|setItem|removeItem)\('(solmint_admin_passcode|solmint_admin_pass_hash|solmint_admin_session)'[^;]*\);/g, '');

// Registration: send the plaintext password over HTTPS to the server; the server hashes it.
replace(/    const passHash = await hashPasscode\(regPassword\.trim\(\)\);[\s\S]*?    alert\('ثبت‌نام حساب کاربری شما با موفقیت در دیتابیس سرور انجام شد\.'\);/, `    const regRes = await registerUserApi({
      username: cleanUsername,
      fullName: cleanFullName,
      password: regPassword.trim(),
      role: 'user'
    });

    if (!regRes.success || !regRes.user) {
      alert(regRes.message || 'ثبت‌نام در سرور انجام نشد.');
      return;
    }

    setUsers(prev => [regRes.user!, ...prev.filter(u => u.id !== regRes.user!.id)]);
    setCurrentUser(regRes.user);
    setIsAuthenticated(true);

    setRegFullName('');
    setRegUsername('');
    setRegPassword('');
    setRegConfirmPassword('');
    alert('ثبت‌نام حساب کاربری شما با موفقیت در سرور انجام شد.');`, 'remove registration client hashing/fallback');

// User management: passwords are sent only as plaintext HTTPS input to server endpoints.
replace(/    let passHash = '';\n    if \(memberPassword\.trim\(\)\) \{\n      passHash = await hashPasscode\(memberPassword\.trim\(\)\);\n    \}\n\n    if \(editingUserId\) \{[\s\S]*?    setShowAddMemberForm\(false\);\n  \};/, `    if (editingUserId) {
      const updatePayload = {
        userId: editingUserId,
        role: memberRole,
        permissions: memberPermissions,
        isActive: memberIsActive,
        ...(memberPassword.trim() ? { password: memberPassword.trim() } : {})
      };
      const ok = await updateUserApi(updatePayload);
      if (!ok) {
        alert('ذخیره تغییرات کاربر در سرور انجام نشد.');
        return;
      }
      const refreshed = await fetchUsersApi();
      setUsers(refreshed);
      setUserManagementNotice(`اطلاعات و دسترسی‌های کاربر "${cleanName}" با موفقیت در سرور به‌روزرسانی شد.`);
    } else {
      if (users.some(u => u.username.toLowerCase() === cleanUser.toLowerCase())) {
        alert('کاربری با این نام کاربری قبلا ثبت شده است.');
        return;
      }
      const regRes = await registerUserApi({
        username: cleanUser,
        fullName: cleanName,
        password: memberPassword.trim(),
        role: memberRole,
        permissions: memberPermissions,
        isActive: memberIsActive
      });
      if (!regRes.success || !regRes.user) {
        alert(regRes.message || 'ایجاد کاربر در سرور انجام نشد.');
        return;
      }
      setUsers(prev => [regRes.user!, ...prev]);
      setUserManagementNotice(`نویسنده/همکار جدید "${cleanName}" با موفقیت در دیتابیس سرور اضافه شد.`);
    }

    setEditingUserId(null);
    setMemberFullName('');
    setMemberUsername('');
    setMemberPassword('');
    setMemberRole('writer');
    setMemberPermissions(['articles', 'editor', 'comments', 'media']);
    setShowAddMemberForm(false);
  };`, 'remove user-management client hashing/fallback');

// User list mutations must always be server-confirmed.
replace(/  const handleToggleUserActive = \(userId: string\) => \{[\s\S]*?  \};\n\n  const handleDeleteUser = \(userId: string\) => \{[\s\S]*?  \};/, `  const handleToggleUserActive = async (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const nextState = !(target.isActive !== false);
    const ok = await updateUserApi({ userId, isActive: nextState });
    if (!ok) {
      alert('تغییر وضعیت کاربر در سرور انجام نشد.');
      return;
    }
    setUsers(await fetchUsersApi());
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('آیا از حذف این کاربر اطمینان دارید؟')) return;
    const ok = await deleteUserApi(userId);
    if (!ok) {
      alert('حذف کاربر از سرور انجام نشد.');
      return;
    }
    setUsers(await fetchUsersApi());
  };`, 'remove local user-management persistence');

// A server-backed CMS must not silently fall back to browser data when a write fails.
text = text.replace(/\s*const newUser: UserAccount = regRes\.user \|\| \{[\s\S]*?createdAt: new Date\(\)\.toLocaleDateString\('fa-IR'\)\n    \};/g, '');

// Remove now-unused password-hash state cleanup.
text = text.replace(/\s*setStoredPassHash\(''\);/g, '');

const forbidden = [
  'hashPasscode',
  'DEFAULT_PASSCODE_HASH',
  'solmint_admin_passcode',
  'solmint_admin_pass_hash',
  'solmint_admin_session',
  'solmint_current_user',
  'safeSetLocalStorage(\'solmint_users\'',
  'localStorage.setItem(\'solmint_users\'',
  'passwordHash: passHash',
  'passwordHash: activeHash'
];
const remaining = forbidden.filter(token => text.includes(token));
if (remaining.length) {
  throw new Error(`Frontend auth hardening failed; legacy auth remains: ${remaining.join(', ')}`);
}

fs.writeFileSync(path, text);
console.log('Admin frontend authentication fully hardened.');
