import express from 'express';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Production authentication for the legacy Express server.
// The only accepted admin credential is the HttpOnly `solmint_session` cookie
// issued by functions/api/users/login.ts. No passcodes, bearer passwords,
// client hashes, or LocalStorage credentials are accepted here.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

async function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function sessionToken(req) {
  const raw = String(req.headers.cookie || '');
  const match = raw.match(/(?:^|;\s*)solmint_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function getAuthenticatedAdmin(req) {
  if (!supabase) return null;
  const token = sessionToken(req);
  if (!token) return null;

  const tokenHash = await sha256(token);
  const { data: sessions, error: sessionError } = await supabase
    .from('auth_sessions')
    .select('user_id,expires_at')
    .eq('token_hash', tokenHash)
    .limit(1);

  if (sessionError || !sessions?.[0]) return null;
  if (!sessions[0].expires_at || Date.parse(sessions[0].expires_at) <= Date.now()) return null;

  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id,username,full_name,role,permissions,is_active,created_at')
    .eq('id', sessions[0].user_id)
    .limit(1);

  if (userError || !users?.[0] || users[0].is_active === false) return null;
  const user = users[0];
  if (!['superadmin', 'admin'].includes(String(user.role))) return null;

  await supabase
    .from('auth_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .catch(() => {});

  return user;
}

async function requireAdmin(req, res, next) {
  try {
    const user = await getAuthenticatedAdmin(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'نشست مدیریتی معتبر نیست یا منقضی شده است.'
      });
    }
    req.__authenticatedAdmin = user;
    next();
  } catch (error) {
    console.error('Production session authentication error:', error?.message || error);
    return res.status(503).json({ success: false, message: 'سرویس احراز هویت در دسترس نیست.' });
  }
}

// The old Express login endpoint is deliberately disabled. Production login is
// exclusively functions/api/users/login.ts, which creates the HttpOnly session.
function rejectLegacyLogin(req, res) {
  return res.status(410).json({
    success: false,
    code: 'LEGACY_AUTH_DISABLED',
    message: 'این مسیر احراز هویت قدیمی غیرفعال است. از احراز هویت سروری استفاده کنید.'
  });
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
  const port = Number(process.env.PORT || 3000);
  try {
    await fetch(`http://127.0.0.1:${port}/api/media/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: String(req.headers.cookie || '')
      },
      body: JSON.stringify({ config })
    });
  } catch (error) {
    console.warn('Production hardening: media config rehydration failed:', error?.message || error);
  }
}

async function moderatePublicComment(body, responseBody) {
  const comment = responseBody?.comment;
  if (!comment?.id) return responseBody;
  const moderated = { ...comment, approved: false };

  try {
    const { saveComment } = await import('../src/utils/serverDataStore.ts');
    saveComment(moderated);
  } catch (_) {}

  if (supabase) {
    try {
      await supabase.from('comments').update({ approved: false }).eq('id', String(comment.id));
      const articleId = String(comment.articleId || body?.articleId || '');
      if (articleId) {
        const { data: article } = await supabase.from('articles').select('id,comments').or(`id.eq.${articleId},slug.eq.${articleId}`).maybeSingle();
        if (article) {
          const comments = Array.isArray(article.comments) ? article.comments : [];
          const updated = comments.map((item) => item?.id === comment.id ? { ...item, approved: false } : item);
          await supabase.from('articles').update({ comments: updated }).eq('id', article.id);
        }
      }
    } catch (error) {
      console.warn('Production hardening: comment moderation sync failed:', error?.message || error);
    }
  }

  return {
    ...responseBody,
    comment: moderated,
    comments: Array.isArray(responseBody.comments)
      ? responseBody.comments.map((item) => item?.id === comment.id ? { ...item, approved: false } : item)
      : responseBody.comments
  };
}

const originalPost = express.application.post;
const originalGet = express.application.get;
const originalDelete = express.application.delete;
const originalJson = express.response.json;

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
      try { await syncMediaConfigIntoServer(req); } finally { next(); }
    });
  }
  if (options.moderateComment) {
    wrapped.unshift((req, res, next) => {
      const sendJson = res.json.bind(res);
      res.json = (body) => {
        Promise.resolve(moderatePublicComment(req.body, body)).then(sendJson);
        return res;
      };
      next();
    });
  }
  return wrapped;
}

express.application.post = function(path, ...handlers) {
  if (path === '/api/users/login') {
    return originalPost.call(this, path, rejectLegacyLogin);
  }
  if (path === '/api/comments/add') {
    return originalPost.call(this, path, ...wrapHandlers(path, handlers, { moderateComment: true }));
  }
  if (typeof path === 'string' && ADMIN_POST_PATHS.has(path)) {
    return originalPost.call(this, path, ...wrapHandlers(path, handlers, { admin: true }));
  }
  if (typeof path === 'string' && MEDIA_POST_PATHS.has(path)) {
    return originalPost.call(this, path, ...wrapHandlers(path, handlers, { admin: true, mediaSync: path !== '/api/media/config' }));
  }
  return originalPost.call(this, path, ...handlers);
};

express.application.delete = function(path, ...handlers) {
  if (path === '/api/articles/:id') {
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
      const hasToken = Boolean(process.env.GITHUB_MEDIA_TOKEN || process.env.GITHUB_TOKEN);
      return res.json({ config, hasToken });
    };
    return originalGet.call(this, path, requireAdmin, mediaGet, ...handlers);
  }
  return originalGet.call(this, path, ...handlers);
};

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

console.info('✓ Production hardening loaded: HttpOnly session authentication only; legacy admin passcode authentication disabled.');
