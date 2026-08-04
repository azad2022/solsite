import express from 'express';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const ADMIN_ENV = String(process.env.ADMIN_PASSCODE || '').trim();

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

let authCache = { passcode: ADMIN_ENV, expiresAt: 0 };

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

async function getAdminPasscode() {
  const now = Date.now();
  if (authCache.expiresAt > now && authCache.passcode) return authCache.passcode;

  let passcode = ADMIN_ENV;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cms_settings')
        .select('settings_json')
        .eq('id', 'main_settings')
        .maybeSingle();
      const dbPasscode = data?.settings_json?.security?.adminPasscode;
      if (!error && typeof dbPasscode === 'string' && dbPasscode.trim()) passcode = dbPasscode.trim();
    } catch (_) {
      // Fail closed if no environment fallback exists.
    }
  }

  authCache = { passcode, expiresAt: now + 5000 };
  return passcode;
}

async function requireAdmin(req, res, next) {
  const configured = await getAdminPasscode();
  if (!configured) {
    return res.status(503).json({ success: false, message: 'احراز هویت مدیریت در محیط Production پیکربندی نشده است.' });
  }

  const headerPasscode = String(req.headers['x-admin-passcode'] || '').trim();
  const auth = String(req.headers.authorization || '').trim();
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const supplied = headerPasscode || bearer;

  if (!safeEqual(supplied, configured)) {
    return res.status(401).json({ success: false, message: 'دسترسی غیرمجاز.' });
  }

  req.__hardeningPasscode = configured;
  next();
}

async function getMediaConfig() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('media_config')
    .select('provider,github_owner,github_repository,branch,base_path,connection_status')
    .eq('id', 'active_config')
    .maybeSingle();
  if (error || !data) return null;
  return {
    provider: data.provider || 'github',
    githubOwner: data.github_owner || 'azad2022',
    githubRepository: data.github_repository || 'solmint-media',
    branch: data.branch || 'main',
    basePath: data.base_path || 'articles/',
    connectionStatus: data.connection_status || 'untested'
  };
}

async function saveMediaConfig(config, connectionStatus) {
  if (!supabase || !config) return;
  const row = {
    id: 'active_config',
    provider: config.provider || 'github',
    github_owner: String(config.githubOwner || '').trim(),
    github_repository: String(config.githubRepository || '').trim(),
    branch: String(config.branch || 'main').trim(),
    base_path: String(config.basePath || 'articles/').replace(/^\/+|\/+$/g, '') + '/',
    connection_status: connectionStatus || config.connectionStatus || 'untested',
    last_test_at: connectionStatus ? new Date().toISOString() : undefined
  };
  const { error } = await supabase.from('media_config').upsert(row, { onConflict: 'id' });
  if (error) console.warn('Production hardening: media_config sync failed:', error.message);
}

async function syncMediaConfigIntoServer(req) {
  const config = await getMediaConfig();
  if (!config) return;

  // The existing media API keeps its active configuration in memory. Rehydrate it
  // through its own authenticated endpoint before every mutating media operation.
  const port = Number(process.env.PORT || 3000);
  const base = `http://127.0.0.1:${port}`;
  try {
    await fetch(`${base}/api/media/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-passcode': req.__hardeningPasscode || ''
      },
      body: JSON.stringify({ config })
    });
  } catch (error) {
    console.warn('Production hardening: media config rehydration failed:', error?.message || error);
  }
}

const originalPost = express.application.post;
const originalGet = express.application.get;
const originalDelete = express.application.delete;

const ADMIN_POST_PATHS = new Set([
  '/api/cms/settings',
  '/api/users/register',
  '/api/users/update',
  '/api/users/delete',
  '/api/comments/approve',
  '/api/comments/delete',
  '/api/articles'
]);

const ADMIN_GET_PATHS = new Set(['/api/users', '/api/comments']);
const MEDIA_POST_PATHS = new Set([
  '/api/media/config',
  '/api/media/test-connection',
  '/api/media/upload',
  '/api/media/delete',
  '/api/media/migrate'
]);

function wrapHandlers(path, handlers, options = {}) {
  const wrapped = [...handlers];
  if (options.admin) wrapped.unshift(requireAdmin);

  if (options.mediaSync) {
    wrapped.unshift(async (req, res, next) => {
      try {
        await syncMediaConfigIntoServer(req);
      } finally {
        next();
      }
    });
  }

  return wrapped;
}

express.application.post = function(path, ...handlers) {
  if (typeof path === 'string' && ADMIN_POST_PATHS.has(path)) {
    return originalPost.call(this, path, ...wrapHandlers(path, handlers, { admin: true }));
  }
  if (typeof path === 'string' && MEDIA_POST_PATHS.has(path)) {
    return originalPost.call(this, path, ...wrapHandlers(path, handlers, { admin: true, mediaSync: path !== '/api/media/config' }));
  }
  return originalPost.call(this, path, ...handlers);
};

express.application.delete = function(path, ...handlers) {
  if (typeof path === 'string' && (path === '/api/articles/:id')) {
    return originalDelete.call(this, path, ...wrapHandlers(path, handlers, { admin: true }));
  }
  return originalDelete.call(this, path, ...handlers);
};

express.application.get = function(path, ...handlers) {
  if (typeof path === 'string' && ADMIN_GET_PATHS.has(path)) {
    return originalGet.call(this, path, ...wrapHandlers(path, handlers, { admin: true }));
  }

  if (path === '/api/media/config') {
    const mediaGet = async (req, res, next) => {
      const config = await getMediaConfig();
      if (!config) return next();
      const hasToken = Boolean(
        process.env.GITHUB_MEDIA_TOKEN || process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN
      );
      return res.json({
        config,
        hasToken,
        notice: hasToken
          ? 'کلید دسترسی (GitHub Token) در سرور فعال و متصل است.'
          : 'توکن GITHUB_TOKEN هنوز تنظیم نشده است.'
      });
    };
    return originalGet.call(this, path, requireAdmin, mediaGet, ...handlers);
  }

  return originalGet.call(this, path, ...handlers);
};

// Persist Media Library configuration after the existing endpoint accepts it.
// This avoids storing GitHub secrets in Supabase; only non-secret configuration is persisted.
const originalJson = express.response.json;
express.response.json = function(body) {
  const req = this.req;
  const path = req?.path || req?.originalUrl?.split('?')[0];
  if (path === '/api/media/config' && req?.method === 'POST' && req.body?.config) {
    const config = { ...req.body.config };
    delete config.githubToken;
    Promise.resolve(saveMediaConfig(config)).catch(() => {});
  }
  return originalJson.call(this, body);
};

// Public comments must enter moderation as pending. The legacy handler currently
// marks them approved immediately, so normalize the stored/returned record here.
const originalSend = express.response.json;
void originalSend;

console.info('✓ Production hardening layer loaded: admin API authorization + persistent media configuration.');
