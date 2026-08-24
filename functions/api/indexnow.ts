type Env = {
  INDEXNOW_KEY?: string;
};

type PageContext = {
  request: Request;
  env?: Env;
};

const SITE_ORIGIN = 'https://solmint.ir';
const DEFAULT_KEY = 'solmint2026indexnowkey';

export async function onRequestPost(context: PageContext): Promise<Response> {
  try {
    const body = await context.request.json() as { urls?: string[]; url?: string };
    const urls: string[] = [];

    if (Array.isArray(body?.urls)) {
      for (const u of body.urls) {
        if (typeof u === 'string' && u.startsWith(SITE_ORIGIN)) urls.push(u);
      }
    } else if (typeof body?.url === 'string' && body.url.startsWith(SITE_ORIGIN)) {
      urls.push(body.url);
    }

    if (!urls.length) {
      return new Response(JSON.stringify({ success: false, message: 'هیچ URL معتبری ارسال نشده است.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const key = context.env?.INDEXNOW_KEY || DEFAULT_KEY;
    const payload = {
      host: 'solmint.ir',
      key: key,
      keyLocation: `${SITE_ORIGIN}/${key}.txt`,
      urlList: urls
    };

    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload)
    });

    return new Response(JSON.stringify({
      success: response.ok,
      status: response.status,
      submittedUrls: urls
    }), {
      status: response.ok ? 200 : response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
