export const onRequestGet = () => new Response(JSON.stringify({ ok: true, service: 'solmint-public-api', version: '2026.08', timestamp: new Date().toISOString() }), {
  status: 200,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=15, s-maxage=15, stale-while-revalidate=60',
    'X-Content-Type-Options': 'nosniff',
  },
});
