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

if (existsSync(new URL('../dist/server.cjs', import.meta.url))) {
  await import('../dist/server.cjs');
} else {
  await import('../server.ts');
}
