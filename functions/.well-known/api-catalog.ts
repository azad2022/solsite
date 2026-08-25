const SITE = 'https://solmint.ir';
const CATALOG = `${SITE}/.well-known/api-catalog`;
const OPENAPI = `${SITE}/openapi.json`;
const DOCS = `${SITE}/api-docs/`;
const HEALTH = `${SITE}/api/health`;

const link = (href: string, type?: string) => ({ href, ...(type ? { type } : {}) });

const catalog = {
  linkset: [
    {
      anchor: `${SITE}/api/articles`,
      'service-desc': [link(OPENAPI, 'application/vnd.oai.openapi+json;version=3.1')],
      'service-doc': [link(`${DOCS}#articles`, 'text/html')],
      status: [link(HEALTH, 'application/json')],
    },
    {
      anchor: `${SITE}/api/solana/status`,
      'service-desc': [link(OPENAPI, 'application/vnd.oai.openapi+json;version=3.1')],
      'service-doc': [link(`${DOCS}#solana-status`, 'text/html')],
      status: [link(HEALTH, 'application/json')],
    },
    {
      anchor: `${SITE}/api/tools/solana-token`,
      'service-desc': [link(OPENAPI, 'application/vnd.oai.openapi+json;version=3.1')],
      'service-doc': [link(`${DOCS}#solana-token`, 'text/html')],
      status: [link(HEALTH, 'application/json')],
    },
    {
      anchor: `${SITE}/api/tools/token-risk`,
      'service-desc': [link(OPENAPI, 'application/vnd.oai.openapi+json;version=3.1')],
      'service-doc': [link(`${DOCS}#token-risk`, 'text/html')],
      status: [link(HEALTH, 'application/json')],
    },
    {
      anchor: `${SITE}/api/tools/market-context`,
      'service-desc': [link(OPENAPI, 'application/vnd.oai.openapi+json;version=3.1')],
      'service-doc': [link(`${DOCS}#market-context`, 'text/html')],
      status: [link(HEALTH, 'application/json')],
    },
    {
      anchor: `${SITE}/api/wallet/analyze`,
      'service-desc': [link(OPENAPI, 'application/vnd.oai.openapi+json;version=3.1')],
      'service-doc': [link(`${DOCS}#wallet-analyze`, 'text/html')],
      status: [link(HEALTH, 'application/json')],
    },
  ],
};

function response(method: 'GET' | 'HEAD') {
  const headers = new Headers({
    'Content-Type': 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"; charset=utf-8',
    'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    'X-Content-Type-Options': 'nosniff',
    Link: `<${CATALOG}>; rel="api-catalog"`,
  });
  return new Response(method === 'HEAD' ? null : JSON.stringify(catalog), { status: 200, headers });
}

export const onRequestGet = () => response('GET');
export const onRequestHead = () => response('HEAD');
