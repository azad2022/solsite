#!/usr/bin/env node
import { access, mkdir, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const migrationDir = path.join(repoRoot, 'supabase/migrations');
const archiveDir = path.join(repoRoot, 'supabase/migration-archive/legacy-2026-09-03');
const baselineName = '20260829090000_solmint_production_baseline.sql';
const baseline = path.join(migrationDir, baselineName);
const [command = 'plan'] = process.argv.slice(2);

function assertCleanGitTree() {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  if (status) throw new Error('Refusing activation with an uncommitted working tree.');
}

function activeMigrationFiles() {
  return readdir(migrationDir, { withFileTypes: true })
    .then((entries) => entries.map((entry) => entry.name).filter((name) => entry.isFile() && name.endsWith('.sql')))
    .then((files) => files.filter((name) => name !== baselineName && !name.includes('_solmint_pay_')).sort());
}

function assertPayChain() {
  const output = execFileSync('bash', ['-lc', "find supabase/migrations -maxdepth 1 -type f -name '*_solmint_pay_*.sql' -print | sort"], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const entries = output ? output.split('\n').filter(Boolean) : [];
  if (entries.length !== 47) throw new Error(`Expected exactly 47 active Pay migrations, found ${entries.length}.`);
}

async function main() {
  await access(baseline);
  const validator = path.join(repoRoot, 'scripts/solmint-pay/baseline-validate.mjs');
  execFileSync(process.execPath, [validator, baseline], { cwd: repoRoot, stdio: 'inherit' });
  assertPayChain();
  const legacyFiles = await activeMigrationFiles();
  if (legacyFiles.length === 0) throw new Error('No legacy migrations found; refusing activation because the repository shape was not independently inspected.');

  if (command === 'plan') {
    console.log(`Canonical baseline ready: ${path.relative(repoRoot, baseline)}`);
    console.log(`Legacy files ready to archive: ${legacyFiles.length}`);
    for (const file of legacyFiles) console.log(`  ${file} -> ${path.relative(repoRoot, path.join(archiveDir, file))}`);
    return;
  }

  if (command !== 'apply') throw new Error('Usage: activate-canonical-baseline.mjs {plan|apply}');
  assertCleanGitTree();
  await mkdir(archiveDir, { recursive: true });
  for (const file of legacyFiles) {
    const source = path.join(migrationDir, file);
    const target = path.join(archiveDir, file);
    try { await access(target); throw new Error(`Archive target already exists: ${target}`); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    await rename(source, target);
  }
  console.log(`Canonical baseline active-migration layout completed; archived ${legacyFiles.length} legacy migration files.`);
}

await main();
