#!/usr/bin/env node
import { access, mkdir, readFile, readdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const migrationDir = path.join(repoRoot, 'supabase/migrations');
const archiveDir = path.join(repoRoot, 'supabase/migration-archive/legacy-2026-09-03');
const baselineName = '20260829090000_solmint_production_baseline.sql';
const baseline = path.join(migrationDir, baselineName);
const EXPECTED_PAY_MIGRATIONS = 52;
const EXPECTED_LEGACY_MIGRATIONS = 15;
const [command = 'plan'] = process.argv.slice(2);

function assertCleanGitTree() {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const unexpected = status.filter((line) => line.slice(3).trim() !== path.relative(repoRoot, baseline));
  if (unexpected.length) throw new Error(`Refusing activation with unexpected uncommitted changes:\n${unexpected.join('\n')}`);
}

async function listSqlFiles(dir) {
  return (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith('.sql')).map((entry) => entry.name).sort();
}

async function activeLegacyMigrationFiles() {
  return (await listSqlFiles(migrationDir)).filter((name) => name !== baselineName && !name.includes('_solmint_pay_'));
}

async function archivedLegacyMigrationFiles() {
  try { return await listSqlFiles(archiveDir); }
  catch (error) { if (error?.code === 'ENOENT') return []; throw error; }
}

async function sha256(file) {
  return crypto.createHash('sha256').update(await readFile(file)).digest('hex');
}

function assertPayChain() {
  const output = execFileSync('bash', ['-lc', "find supabase/migrations -maxdepth 1 -type f -name '*_solmint_pay_*.sql' -print | sort"], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const entries = output ? output.split('\n').filter(Boolean) : [];
  if (entries.length !== EXPECTED_PAY_MIGRATIONS) throw new Error(`Expected exactly ${EXPECTED_PAY_MIGRATIONS} active Pay migrations, found ${entries.length}.`);
}

async function main() {
  await access(baseline);
  const validator = path.join(repoRoot, 'scripts/solmint-pay/baseline-validate.mjs');
  execFileSync(process.execPath, [validator, baseline], { cwd: repoRoot, stdio: 'inherit' });
  assertPayChain();

  const activeLegacy = await activeLegacyMigrationFiles();
  const archivedLegacy = await archivedLegacyMigrationFiles();
  const archiveSet = new Set(archivedLegacy);

  if (activeLegacy.length === 0) {
    if (archivedLegacy.length < EXPECTED_LEGACY_MIGRATIONS) throw new Error('Canonical baseline layout is incomplete: legacy archive is missing historical migrations.');
    console.log('Canonical baseline already active; no legacy SQL remains in the execution directory.');
    return;
  }

  if (activeLegacy.length !== EXPECTED_LEGACY_MIGRATIONS) throw new Error(`Expected ${EXPECTED_LEGACY_MIGRATIONS} active legacy migrations before archive, found ${activeLegacy.length}.`);

  if (command === 'plan') {
    console.log(`Canonical baseline ready: ${path.relative(repoRoot, baseline)}`);
    console.log(`Legacy files ready for canonicalization: ${activeLegacy.length}`);
    for (const file of activeLegacy) console.log(`  ${file} -> ${path.relative(repoRoot, path.join(archiveDir, file))}${archiveSet.has(file) ? ' (existing archive; bytes will be verified)' : ''}`);
    return;
  }

  if (command !== 'apply') throw new Error('Usage: activate-canonical-baseline.mjs {plan|apply}');
  assertCleanGitTree();
  await mkdir(archiveDir, { recursive: true });
  for (const file of activeLegacy) {
    const source = path.join(migrationDir, file);
    const target = path.join(archiveDir, file);
    if (archiveSet.has(file)) {
      if (await sha256(source) !== await sha256(target)) throw new Error(`Archive target differs from active legacy migration: ${file}`);
      await unlink(source);
    } else {
      await rename(source, target);
    }
  }
  console.log(`Canonical baseline active-migration layout completed; removed/archived ${activeLegacy.length} legacy migration files.`);
}

await main();
