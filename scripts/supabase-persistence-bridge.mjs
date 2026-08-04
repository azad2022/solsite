import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://nvopkbiedorfshwbmyhn.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!key) {
  console.warn('⚠️ Supabase persistence bridge disabled: no server-side Supabase credential configured.');
} else {
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const readJson = (file) => {
    try {
      if (!fs.existsSync(file)) return null;
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      console.warn(`⚠️ Could not read ${file}:`, error?.message || error);
      return null;
    }
  };

  const writeJson = (file, value) => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
      fs.renameSync(tmp, file);
      return true;
    } catch (error) {
      console.warn(`⚠️ Could not hydrate ${file}:`, error?.message || error);
      return false;
    }
  };

  let settingsTimer = null;
  let usersTimer = null;
  let hydrating = true;

  const syncSettingsToDb = async () => {
    const settings = readJson(SETTINGS_FILE);
    if (!settings || typeof settings !== 'object') return;
    const { error } = await supabase.from('cms_settings').upsert({
      id: 'main_settings',
      settings_json: settings,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
    if (error) console.warn('⚠️ CMS settings Supabase sync failed:', error.message);
  };

  const syncUsersToDb = async () => {
    const users = readJson(USERS_FILE);
    if (!Array.isArray(users)) return;
    for (const user of users) {
      if (!user?.id || !user?.username) continue;
      const payload = {
        id: String(user.id),
        username: String(user.username).trim().toLowerCase(),
        full_name: String(user.fullName || user.username),
        password_hash: String(user.passwordHash || ''),
        role: user.role || 'user',
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
        is_active: user.isActive !== false
      };
      if (user.createdAt && !String(user.createdAt).includes('/')) payload.created_at = user.createdAt;

      const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
      if (error) console.warn(`⚠️ User ${user.username} Supabase sync failed:`, error.message);
    }
  };

  const hydrateSettingsFromDb = async () => {
    const { data, error } = await supabase.from('cms_settings').select('settings_json').eq('id', 'main_settings').maybeSingle();
    if (error) {
      console.warn('⚠️ Could not read CMS settings from Supabase:', error.message);
      return false;
    }
    if (data?.settings_json && typeof data.settings_json === 'object') {
      return writeJson(SETTINGS_FILE, data.settings_json);
    }
    return false;
  };

  const hydrateUsersFromDb = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id,username,full_name,password_hash,role,permissions,is_active,created_at')
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('⚠️ Could not read users from Supabase:', error.message);
      return false;
    }
    if (Array.isArray(data) && data.length > 0) {
      const users = data.map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.full_name,
        passwordHash: u.password_hash,
        role: u.role,
        permissions: u.permissions || [],
        isActive: u.is_active !== false,
        createdAt: u.created_at
      }));
      return writeJson(USERS_FILE, users);
    }
    return false;
  };

  const bootstrap = async () => {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    const settingsHydrated = await hydrateSettingsFromDb();
    if (!settingsHydrated) await syncSettingsToDb();

    const usersHydrated = await hydrateUsersFromDb();
    if (!usersHydrated) await syncUsersToDb();

    hydrating = false;
  };

  await bootstrap();

  fs.watchFile(SETTINGS_FILE, { interval: 1500 }, () => {
    if (hydrating) return;
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(() => syncSettingsToDb().catch(() => {}), 500);
  });

  fs.watchFile(USERS_FILE, { interval: 1500 }, () => {
    if (hydrating) return;
    clearTimeout(usersTimer);
    usersTimer = setTimeout(() => syncUsersToDb().catch(() => {}), 500);
  });
}
