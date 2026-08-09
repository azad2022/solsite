import { createClient } from '@supabase/supabase-js';

type CmsSettingsRow = {
  id: string;
  settings_json: Record<string, any> | null;
};

const SUPABASE_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XaeRMCeIhR7-Zwq6YhdkVw_cOwO9OLt';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Vary': 'Origin'
    }
  });
}

async function getSettings(): Promise<Record<string, any>> {
  const { data, error } = await supabase
    .from('cms_settings')
    .select('id, settings_json')
    .eq('id', 'main_settings')
    .maybeSingle<CmsSettingsRow>();

  if (error) throw error;

  const settings = data?.settings_json && typeof data.settings_json === 'object'
    ? data.settings_json
    : {};

  if (!settings.chatbot || typeof settings.chatbot !== 'object') {
    settings.chatbot = {};
  }

  // Never let a missing/invalid flag enable the public chatbot.
  settings.chatbot.enabled = settings.chatbot.enabled === true;
  return settings;
}

export const onRequestGet = async () => {
  try {
    const settings = await getSettings();
    return jsonResponse({ success: true, settings });
  } catch (error) {
    console.error('CMS settings GET failed:', error);
    return jsonResponse({ success: false, message: 'CMS settings temporarily unavailable.' }, 503);
  }
};

export const onRequestPost = async ({ request }: { request: Request }) => {
  try {
    const suppliedPasscode = String(request.headers.get('x-admin-passcode') || '').trim();
    const current = await getSettings();
    const configuredPasscode = String(current.security?.adminPasscode || '').trim();

    if (!suppliedPasscode || !configuredPasscode || suppliedPasscode !== configuredPasscode) {
      return jsonResponse({ success: false, message: 'Unauthorized' }, 401);
    }

    const body = await request.json() as { settings?: Record<string, any> };
    if (!body?.settings || typeof body.settings !== 'object') {
      return jsonResponse({ success: false, message: 'Invalid settings payload.' }, 400);
    }

    const incoming = body.settings;
    const updated = {
      ...current,
      ...incoming,
      chatbot: {
        ...(current.chatbot || {}),
        ...(incoming.chatbot || {})
      },
      deepseek: {
        ...(current.deepseek || {}),
        ...(incoming.deepseek || {})
      },
      downloads: {
        ...(current.downloads || {}),
        ...(incoming.downloads || {})
      },
      security: {
        ...(current.security || {}),
        ...(incoming.security || {})
      }
    };

    // The public visibility flag is persisted as a real boolean only.
    updated.chatbot.enabled = incoming.chatbot?.enabled === true;

    const { data, error } = await supabase
      .from('cms_settings')
      .upsert({
        id: 'main_settings',
        settings_json: updated,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select('id, settings_json')
      .single<CmsSettingsRow>();

    if (error) throw error;

    return jsonResponse({
      success: true,
      settings: data?.settings_json || updated,
      message: 'Settings saved to Supabase.'
    });
  } catch (error) {
    console.error('CMS settings POST failed:', error);
    return jsonResponse({ success: false, message: 'CMS settings could not be saved.' }, 500);
  }
};
