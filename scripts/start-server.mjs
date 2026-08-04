import 'dotenv/config';
import { existsSync } from 'node:fs';

// Server-only Supabase credential.
// The service-role key must never be exposed to Vite/client code.
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.VITE_SUPABASE_ANON_KEY;
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY is not configured. Database writes will fail under hardened RLS policies.');
}

// Hydrate the server-side JSON persistence layer from Supabase before the app starts,
// and continuously mirror settings/users changes back to Supabase. This keeps the
// existing synchronous serverDataStore API compatible while making Supabase the
// durable production persistence layer.
try {
  await import('./supabase-persistence-bridge.mjs');
} catch (error) {
  console.error('⚠️ Supabase persistence bridge failed; continuing with local server persistence:', error?.message || error);
}

if (existsSync(new URL('../dist/server.cjs', import.meta.url))) {
  await import('../dist/server.cjs');
} else {
  await import('../server.ts');
}
