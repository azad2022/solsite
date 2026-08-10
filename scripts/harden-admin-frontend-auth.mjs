import fs from 'fs';

const path = 'src/components/AdminCmsModal.tsx';
let text = fs.readFileSync(path, 'utf8');
function replace(re, value, label) {
  const next = text.replace(re, value);
  if (next === text) throw new Error(`Frontend auth hardening failed: ${label}`);
  text = next;
}

replace(/\/\/ SHA-256 helper for client-side password hashing[\s\S]*?const DEFAULT_PASSCODE_HASH = '[^']+';\n\n/, '', 'remove client hash constants');
replace(/const \[users, setUsers\] = useState<UserAccount\[\]>\(\(\) => \{[\s\S]*?\}\);/, 'const [users, setUsers] = useState<UserAccount[]>([]);', 'remove local user bootstrap');
replace(/const \[storedPassHash, setStoredPassHash\] = useState\(\(\) => \{[\s\S]*?\}\);/, "const [storedPassHash, setStoredPassHash] = useState('');", 'remove stored client password hash');
replace(/const \[isAuthenticated, setIsAuthenticated\] = useState\(\(\) => \{[\s\S]*?\n  \}\);/, "const [isAuthenticated, setIsAuthenticated] = useState(Boolean(currentUser));", 'remove local session bootstrap');

replace(/  useEffect\(\(\) => \{\n    if \(isOpen && isAuthenticated\) \{\n      \/\/ Validate server session auth[\s\S]*?    \}\n  \}, \[isOpen, isAuthenticated\]\);/, `  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/users/me', { credentials: 'include', cache: 'no-store' })
      .then(async res => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data?.success && data.user) {
          setCurrentUser(data.user);
          setIsAuthenticated(true);
          setAuthError('');
          getAllMediaAssets().then(assets => { if (!cancelled) setGithubMediaAssets(assets || []); });
          getMediaStorageConfig().then(cfg => {
            if (!cancelled && cfg) {
              setMediaConfigState(cfg);
              setConfigOwner(cfg.githubOwner || 'azad2022');
              setConfigRepo(cfg.githubRepository || 'solmint-media');
              setConfigBranch(cfg.branch || 'main');
              setConfigBasePath(cfg.basePath || 'articles/');
            }
          });
        } else {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      });
    return () => { cancelled = true; };
  }, [isOpen]);`, 'replace client session validation');

replace(/  \/\/ UNIFIED AUTH: LOGIN FOR ADMIN AND USERS[\s\S]*?\n  \/\/ REGISTER NEW REAL USER ACCOUNT/, `  // UNIFIED AUTH: server-only login for admin and users
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTimer > 0) return;
    const identifier = loginIdentifier.trim();
    const pass = loginPassword.trim();
    if (!identifier || !pass) {
      setAuthError('نام کاربری و رمز عبور الزامی است.');
      return;
    }

    const authRes = await loginUserApi({ username: identifier, passcode: pass });
    if (authRes.success && authRes.user) {
      const user = authRes.user;
      setIsAuthenticated(true);
      setCurrentUser(user);
      setAuthError('');
      setFailedAttempts(0);
      setLoginPassword('');
      const userPerms = user.permissions && user.permissions.length > 0
        ? user.permissions
        : (user.role === 'superadmin' || user.role === 'admin' ? ALL_ADMIN_PERMISSIONS : ['articles', 'editor', 'comments', 'media']);
      if (!userPerms.includes(adminTab)) setAdminTab(userPerms[0] || 'articles');
      return;
    }

    const attempts = failedAttempts + 1;
    setFailedAttempts(attempts);
    if (attempts >= 3) {
      setLockoutTimer(60);
      setAuthError('تعداد تلاش‌های ناموفق بیش از حد مجاز است. سیستم برای ۶۰ ثانیه قفل شد.');
    } else {
      setAuthError(authRes.message || `اطلاعات ورود نادرست است. (${3 - attempts} تلاش باقی مانده)`);
    }
  };

  // REGISTER NEW REAL USER ACCOUNT`, 'replace login flow');

replace(/  const handleLogout = \(\) => \{[\s\S]*?\n  \};/, `  const handleLogout = async () => {
    try { await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }); } catch {}
    setIsAuthenticated(false);
    setCurrentUser(null);
    setLoginIdentifier('');
    setLoginPassword('');
  };`, 'replace logout flow');

replace(/  const handleChangePasscode = async \(e: React\.FormEvent\) => \{[\s\S]*?\n  \};/, `  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const currentPassword = currentPassInput.trim();
    const newPassword = newPassInput.trim();
    if (!currentPassword || newPassword.length < 8 || newPassword !== confirmPassInput.trim()) {
      alert('رمز فعلی، رمز جدید و تکرار رمز جدید را به‌درستی وارد کنید. رمز جدید باید حداقل ۸ کاراکتر باشد.');
      return;
    }
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        alert(data?.message || 'تغییر رمز عبور انجام نشد.');
        return;
      }
      setPassChangeSuccess('رمز عبور با موفقیت تغییر کرد.');
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
      setStoredPassHash('');
      setTimeout(() => setPassChangeSuccess(''), 4000);
    } catch {
      alert('ارتباط با سرویس احراز هویت برقرار نشد.');
    }
  };`, 'replace password change flow');

fs.writeFileSync(path, text);
console.log('Admin frontend authentication hardened.');
