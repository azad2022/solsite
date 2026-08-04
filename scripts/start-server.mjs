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

// Load the production hardening layer before Express registers its routes.
// It enforces admin authorization and keeps media configuration persistent.
try {
  await import('./production-hardening.mjs');
} catch (error) {
  console.error('❌ Production hardening layer failed to load:', error?.message || error);
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

// Hydrate the server-side JSON persistence layer from Supabase before the app starts,
// and continuously mirror settings/users changes back to Supabase.
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
