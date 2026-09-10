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
 *
 * The live migration ledger is compared with the migration files currently
 * checked into this repository. No historical counts or Pay-table absence
 * assumptions are hard-coded here; those assumptions became stale as Pay
 * migrations were applied to Production.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const PROJECT_REF = 'nvopkbiedorfshwbmyhn';
const BASELINE_VERSION = '20260829090000';

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

const psql = (sql) => execFileSync(
  'psql',
  ['-v', 'ON_ERROR_STOP=1', '-At', '-F', '|', '-c', sql],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
).trim();

const repositoryMigrations = readdirSync('supabase/migrations', { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
  .map((entry) => entry.name.match(/^(\d{8,14})_(.+)\.sql$/))
  .filter(Boolean)
  .map((match) => ({ version: match[1], name: match[2] }))
  .sort((a, b) => a.version.localeCompare(b.version) || a.name.localeCompare(b.name));

if (repositoryMigrations.length === 0) {
  throw new Error('FAIL-CLOSED: no repository migrations were discovered');
}

const duplicateRepositoryVersions = repositoryMigrations
  .filter((row, index, rows) => index > 0 && rows[index - 1].version === row.version)
  .map((row) => row.version);
if (duplicateRepositoryVersions.length > 0) {
  throw new Error(`FAIL-CLOSED: duplicate repository migration versions: ${[...new Set(duplicateRepositoryVersions)].join(', ')}`);
}

const rows = psql(
  'select version,name from supabase_migrations.schema_migrations order by version asc;',
).split('\n').filter(Boolean).map((row) => {
  const [version, ...nameParts] = row.split('|');
  return { version, name: nameParts.join('|') };
});

if (rows.length === 0) {
  throw new Error('FAIL-CLOSED: Production migration history is empty');
}

if (rows.length !== repositoryMigrations.length) {
  throw new Error(
    `FAIL-CLOSED: live migration count ${rows.length} != repository migration count ${repositoryMigrations.length}`,
  );
}

for (let i = 0; i < repositoryMigrations.length; i += 1) {
  if (rows[i]?.version !== repositoryMigrations[i].version || rows[i]?.name !== repositoryMigrations[i].name) {
    throw new Error(
      `FAIL-CLOSED: live migration history mismatch at index ${i}: ` +
      `live=${rows[i]?.version ?? 'missing'}:${rows[i]?.name ?? 'missing'} ` +
      `repo=${repositoryMigrations[i].version}:${repositoryMigrations[i].name}`,
    );
  }
}

if (rows[0].version !== BASELINE_VERSION || rows[0].name !== 'solmint_production_baseline') {
  throw new Error('FAIL-CLOSED: unexpected first Production migration; canonical baseline drift detected');
}

const payMigrationRows = rows.filter((row) => /solmint_pay/i.test(row.name));
if (payMigrationRows.length === 0) {
  throw new Error('FAIL-CLOSED: no SolMint Pay migrations are present in Production history');
}

const payRelations = Number(psql(
  "select count(*) from information_schema.tables where table_schema='public' and table_name like 'pay_%';",
));
if (!Number.isInteger(payRelations) || payRelations <= 0) {
  throw new Error(`FAIL-CLOSED: expected Pay relations in Production, found ${payRelations}`);
}

const baselineRows = Number(psql(
  `select count(*) from supabase_migrations.schema_migrations where version='${BASELINE_VERSION}';`,
));
if (baselineRows !== 1) {
  throw new Error('FAIL-CLOSED: canonical Production baseline is missing or duplicated');
}

const expectedRef = process.env.SOLMINT_PAY_PRODUCTION_CONFIRM_REF;
if (expectedRef && process.env.GITHUB_SHA !== expectedRef) {
  throw new Error('FAIL-CLOSED: audited git SHA confirmation mismatch');
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  mode: 'read-only',
  projectRef: PROJECT_REF,
  productionHistoryCount: rows.length,
  repositoryMigrationCount: repositoryMigrations.length,
  payMigrationCount: payMigrationRows.length,
  payFirstMigration: payMigrationRows[0],
  payLastMigration: payMigrationRows[payMigrationRows.length - 1],
  payRelations,
  baselinePresent: true,
  repositoryLedgerAligned: true,
}, null, 2)}\n`);
