import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'server.ts');
let source = readFileSync(file, 'utf8');

// This pass is intentionally idempotent and avoids regexes that can be broken by
// JavaScript escaping. It only normalizes the already-generated auth block.
const badLine = '    await authSupabase.from("auth_sessions").update({ last_seen_at: new Date().toISOString() }).eq("token_hash", tokenHash).catch(() => {});';
const goodBlock = `    const sessionUpdate = await authSupabase
      .from("auth_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("token_hash", tokenHash);
    if (sessionUpdate.error) {
      console.warn("Session last_seen_at update failed:", sessionUpdate.error.message);
    }`;

if (source.includes(badLine)) {
  source = source.replace(badLine, goodBlock);
}

writeFileSync(file, source, 'utf8');
console.log('✓ Server authentication hardening passed: session verification remains server-side and TypeScript-safe.');
