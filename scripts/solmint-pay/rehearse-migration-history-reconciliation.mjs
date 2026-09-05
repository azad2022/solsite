#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const manifestPath = path.join(ROOT, 'scripts/solmint-pay/production-migration-history-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const PAY_GLOB = 'supabase/migrations/*_solmint_pay_*.sql';
const BASELINE_VERSION = '20260829090000';
const expectedPayCount = 51;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(Array.isArray(manifest), 'Production migration history manifest must be an array.');
assert(manifest.length === 56, `Expected 56 captured Production migrations, found ${manifest.length}.`);
assert(new Set(manifest.map((m) => m.version)).size === manifest.length, 'Production migration versions must be unique.');
assert(manifest.every((m) => /^\d{14}$/.test(m.version) && typeof m.name === 'string' && m.name.length > 0), 'Production migration manifest contains an invalid entry.');
assert(manifest.every((m, i) => i === 0 || manifest[i - 1].version < m.version), 'Production migration manifest must be strictly timestamp-ordered.');
assert(!manifest.some((m) => m.version === BASELINE_VERSION), 'Canonical baseline must not already exist in the captured Production history.');

const plan = {
  sourceHistory: manifest,
  sourceHistoryCount: manifest.length,
  operationOrder: [
    'PRECHECK: read current Production migration history; require exact 56-version manifest match; abort on any drift.',
    'PRECHECK: verify live Production schema still matches frozen schema snapshot SHA-256 553d0f9a34f52ef344471c45398c41780438c0dbeec5d6cc63c912d6a8b223c5.',
    'PRECHECK: verify Pay feature remains disabled and no pay_% relations exist in Production.',
    'REPAIR: mark all captured 56 historical versions as reverted; migration repair changes tracking only and executes no SQL.',
    `REPAIR: mark baseline ${BASELINE_VERSION} as applied; this records the already-present Production schema as the canonical baseline and executes no SQL.`,
    'VERIFY: require remote migration history to equal baseline + exactly 51 Pay migration versions.',
    'DEPLOY: run db push; because baseline is recorded as applied and the 56 old versions are no longer active history, only the 51 pending Pay migrations may execute.',
    'POSTCHECK: verify schema invariants, Pay objects, security-definer search_path, RLS/grants, and migration history.',
  ],
  guardrails: [
    'Never use direct INSERT/DELETE against supabase_migrations.schema_migrations in Production.',
    'Never execute the 56 legacy SQL files during reconciliation.',
    'Abort if any Production migration version/name differs from the frozen manifest.',
    'Abort if Production schema SHA differs from the frozen capture.',
    'Abort if any unexpected Pay object exists before deployment.',
    'Abort on any db push plan containing a legacy version or baseline version as executable SQL.',
    'Abort on any migration failure; never treat partial execution as success.',
  ],
};

const repairCommands = manifest.map((m) => `supabase migration repair --status reverted ${m.version}`);
const baselineApply = `supabase migration repair --status applied ${BASELINE_VERSION}`;

console.log(JSON.stringify({
  ok: true,
  mode: 'rehearsal-plan',
  manifestCount: manifest.length,
  targetHistoryCount: expectedPayCount + 1,
  targetHistory: [BASELINE_VERSION, '<51 Pay migration versions>'],
  repairCommands,
  baselineApply,
  plan,
}, null, 2));
