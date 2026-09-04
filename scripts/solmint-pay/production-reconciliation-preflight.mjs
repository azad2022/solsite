#!/usr/bin/env node

/**
 * Read-only Production reconciliation preflight.
 *
 * This script never changes migration history or schema. It validates the
 * repository-side prerequisites immediately before an authorized Production
 * reconciliation cutover.
 *
 * The caller must provide a PostgreSQL connection through PG* environment
 * variables. This avoids constructing a URI containing a password and avoids
 * password/URL encoding ambiguity.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PROJECT_REF = 'nvopkbiedorfshwbmyhn';
const BASELINE_VERSION = '20260829090000';
const PAY_FIRST_VERSION = '20260830000000';
const EXPECTED_PRODUCTION_HISTORY_COUNT = 56;
const EXPECTED_PAY_RELATIONS = 0;
const EXPECTED_PAY_HISTORY_ROWS = 0;
const EXPECTED_SCHEMA_SHA256 = '553d0f9a34f52ef344471c45398c41780438c0dbeec5d6cc63c912d6a8b223c5';

for (const variable of ['PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE', 'PGPASSWORD']) {
  if (!process.env[variable]) {
    throw new Error(`FAIL-CLOSED: ${variable} is required`);
  }
}

if (process.env.PGHOST !== `db.${PROJECT_REF}.supabase.co`) {
  throw new Error('FAIL-CLOSED: PGHOST does not match the expected Production project');
}
if (process.env.PGPORT !== '5432') {
  throw new Error('FAIL-CLOSED: PGPORT must be 5432');
}
if (process.env.PGUSER !== 'postgres' || process.env.PGDATABASE !== 'postgres') {
  throw new Error('FAIL-CLOSED: unexpected Production database identity');
}

const manifest = JSON.parse(
  readFileSync('scripts/solmint-pay/production-migration-history-manifest.json', 'utf8'),
);
if (!Array.isArray(manifest) || manifest.length !== EXPECTED_PRODUCTION_HISTORY_COUNT) {
  throw new Error(`FAIL-CLOSED: expected exactly ${EXPECTED_PRODUCTION_HISTORY_COUNT} manifest entries`);
}

const psql = (sql) => execFileSync(
  'psql',
  ['-v', 'ON_ERROR_STOP=1', '-At', '-F', '|', '-c', sql],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
).trim();

const rows = psql(
  'select version,name from supabase_migrations.schema_migrations order by version asc;',
).split('\n').filter(Boolean).map((row) => {
  const [version, ...nameParts] = row.split('|');
  return { version, name: nameParts.join('|') };
});

if (rows.length !== EXPECTED_PRODUCTION_HISTORY_COUNT) {
  throw new Error(`FAIL-CLOSED: live history count ${rows.length} != ${EXPECTED_PRODUCTION_HISTORY_COUNT}`);
}

for (let i = 0; i < manifest.length; i += 1) {
  if (rows[i]?.version !== manifest[i].version || rows[i]?.name !== manifest[i].name) {
    throw new Error(`FAIL-CLOSED: live migration history mismatch at index ${i}`);
  }
}

const payRelations = Number(psql(
  "select count(*) from information_schema.tables where table_schema='public' and table_name like 'pay_%';",
));
if (payRelations !== EXPECTED_PAY_RELATIONS) {
  throw new Error(`FAIL-CLOSED: Production contains ${payRelations} pay_* tables`);
}

const payHistoryRows = Number(psql(
  `select count(*) from supabase_migrations.schema_migrations where version >= '${PAY_FIRST_VERSION}';`,
));
if (payHistoryRows !== EXPECTED_PAY_HISTORY_ROWS) {
  throw new Error(`FAIL-CLOSED: Production has ${payHistoryRows} Pay migration history rows`);
}

const baselineRows = Number(psql(
  `select count(*) from supabase_migrations.schema_migrations where version='${BASELINE_VERSION}';`,
));
if (baselineRows !== 0) {
  throw new Error('FAIL-CLOSED: canonical baseline is unexpectedly already in Production history');
}

const expectedRef = process.env.SOLMINT_PAY_PRODUCTION_CONFIRM_REF;
if (expectedRef && process.env.GITHUB_SHA !== expectedRef) {
  throw new Error('FAIL-CLOSED: audited git SHA confirmation mismatch');
}

const expectedSchemaSha = process.env.SOLMINT_PAY_PRODUCTION_SCHEMA_SHA256 ?? EXPECTED_SCHEMA_SHA256;
if (!/^[a-f0-9]{64}$/.test(expectedSchemaSha)) {
  throw new Error('FAIL-CLOSED: invalid expected schema SHA-256');
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  mode: 'read-only',
  projectRef: PROJECT_REF,
  productionHistoryCount: rows.length,
  targetHistoryCount: 52,
  payMigrationCount: 51,
  payRelations,
  payHistoryRows,
  baselinePresent: false,
  expectedSchemaSha256: expectedSchemaSha,
}, null, 2)}\n`);
