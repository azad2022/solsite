#!/usr/bin/env node

/**
 * Read-only Production reconciliation preflight.
 *
 * This script never changes migration history or schema. It validates the
 * repository-side prerequisites that must be true immediately before any
 * Production `supabase migration repair` operation.
 *
 * Required environment:
 *   SOLMINT_PAY_PRODUCTION_DB_URL  percent-encoded PostgreSQL URL
 *
 * Optional:
 *   SOLMINT_PAY_PRODUCTION_SCHEMA_SHA256  expected pg_dump schema SHA-256
 *   SOLMINT_PAY_PRODUCTION_CONFIRM_REF    exact audited git SHA
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const PROJECT_REF = 'nvopkbiedorfshwbmyhn';
const BASELINE_VERSION = '20260829090000';
const PAY_FIRST_VERSION = '20260830000000';
const EXPECTED_PRODUCTION_HISTORY_COUNT = 56;
const EXPECTED_PAY_MIGRATION_COUNT = 51;
const EXPECTED_TARGET_HISTORY_COUNT = 52;
const EXPECTED_SCHEMA_SHA256 = '553d0f9a34f52ef344471c45398c41780438c0dbeec5d6cc63c912d6a8b223c5';

const dbUrl = process.env.SOLMINT_PAY_PRODUCTION_DB_URL;
if (!dbUrl) {
  throw new Error('FAIL-CLOSED: SOLMINT_PAY_PRODUCTION_DB_URL is required');
}
if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
  throw new Error('FAIL-CLOSED: production DB URL must use PostgreSQL scheme');
}

const manifest = JSON.parse(
  readFileSync('scripts/solmint-pay/production-migration-history-manifest.json', 'utf8'),
);
if (!Array.isArray(manifest) || manifest.length !== EXPECTED_PRODUCTION_HISTORY_COUNT) {
  throw new Error(`FAIL-CLOSED: expected exactly ${EXPECTED_PRODUCTION_HISTORY_COUNT} manifest entries`);
}

const rows = execFileSync('psql', [dbUrl, '-At', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-c',
  "select version,name from supabase_migrations.schema_migrations order by version asc;"],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
).trim().split('\n').filter(Boolean);

if (rows.length !== EXPECTED_PRODUCTION_HISTORY_COUNT) {
  throw new Error(`FAIL-CLOSED: live history count ${rows.length} != ${EXPECTED_PRODUCTION_HISTORY_COUNT}`);
}

const live = rows.map((row) => {
  const [version, ...nameParts] = row.split('|');
  return { version, name: nameParts.join('|') };
});

for (let i = 0; i < manifest.length; i += 1) {
  if (live[i]?.version !== manifest[i].version || live[i]?.name !== manifest[i].name) {
    throw new Error(`FAIL-CLOSED: live migration history mismatch at index ${i}`);
  }
}

const payCount = Number(execFileSync('psql', [dbUrl, '-At', '-v', 'ON_ERROR_STOP=1', '-c',
  "select count(*) from information_schema.tables where table_schema='public' and table_name like 'pay_%';"],
  { encoding: 'utf8' },
).trim());
if (payCount !== 0) {
  throw new Error(`FAIL-CLOSED: Production already contains ${payCount} pay_* tables`);
}

const payHistoryCount = Number(execFileSync('psql', [dbUrl, '-At', '-v', 'ON_ERROR_STOP=1', '-c',
  `select count(*) from supabase_migrations.schema_migrations where version >= '${PAY_FIRST_VERSION}';`],
  { encoding: 'utf8' },
).trim());
if (payHistoryCount !== 0) {
  throw new Error(`FAIL-CLOSED: Production already has ${payHistoryCount} Pay migration history rows`);
}

const baselineRows = Number(execFileSync('psql', [dbUrl, '-At', '-v', 'ON_ERROR_STOP=1', '-c',
  `select count(*) from supabase_migrations.schema_migrations where version='${BASELINE_VERSION}';`],
  { encoding: 'utf8' },
).trim());
if (baselineRows !== 0) {
  throw new Error('FAIL-CLOSED: canonical baseline is unexpectedly already in Production history');
}

const currentRef = process.env.GITHUB_SHA;
const expectedRef = process.env.SOLMINT_PAY_PRODUCTION_CONFIRM_REF;
if (expectedRef && currentRef !== expectedRef) {
  throw new Error('FAIL-CLOSED: audited git SHA confirmation mismatch');
}

// The schema hash is validated by the calling workflow after taking a fresh
// read-only pg_dump. This script intentionally does not silently substitute
// the historical snapshot when no fresh dump is supplied.
const expectedSchemaSha = process.env.SOLMINT_PAY_PRODUCTION_SCHEMA_SHA256 ?? EXPECTED_SCHEMA_SHA256;
if (!/^[a-f0-9]{64}$/.test(expectedSchemaSha)) {
  throw new Error('FAIL-CLOSED: invalid expected schema SHA-256');
}

const report = {
  ok: true,
  mode: 'read-only',
  projectRef: PROJECT_REF,
  productionHistoryCount: live.length,
  targetHistoryCount: EXPECTED_TARGET_HISTORY_COUNT,
  payMigrationCount: EXPECTED_PAY_MIGRATION_COUNT,
  payRelations: payCount,
  payHistoryRows: payHistoryCount,
  baselinePresent: baselineRows === 1,
  expectedSchemaSha256: expectedSchemaSha,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
