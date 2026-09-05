#!/usr/bin/env node
import { access, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const migrationDir = path.join(repoRoot, 'supabase/migrations');
const archiveDir = path.join(repoRoot, 'supabase/migration-archive/legacy-2026-09-03');
const baseline = path.join(migrationDir, '20260829090000_solmint_production_baseline.sql');

const legacyFiles = [
  '20260804212636_harden_public_rls_and_function_permissions.sql',
  '20260804212725_revoke_public_table_mutations.sql',
  '20260804215020_harden_public_rls_and_article_timestamps.sql',
  '20260804215706_enforce_admin_user_uniqueness_and_settings_persistence.sql',
  '20260804220556_persist_active_media_config_defaults.sql',
  '20260805083846_enable_autopublish_scheduler_extensions.sql',
  '20260805083916_add_autopublish_scheduler_control.sql',
  '20260805083950_add_autopublish_lock.sql',
  '20260805083957_expose_autopublish_lock_rpc.sql',
  '20260805084011_fix_autopublish_token_verifier.sql',
  '20260805094225_add_chatbot_rate_limit.sql',
  '20260805095150_secure_cms_settings_from_anon.sql',
  '20260805095458_move_deepseek_secret_out_of_cms_settings.sql',
  '20260805102324_lock_down_media_client_writes.sql',
];

const [command = 'plan'] = process.argv.slice(2);

function assertCleanGitTree() {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  if (status) throw new Error('Refusing activation with an uncommitted working tree.');
}

async function main() {
  await access(baseline);
  const validator = path.join(repoRoot, 'scripts/solmint-pay/baseline-validate.mjs');
  execFileSync(process.execPath, [validator, baseline], { cwd: repoRoot, stdio: 'inherit' });

  const existing = [];
  for (const file of legacyFiles) {
    const source = path.join(migrationDir, file);
    try { await access(source); existing.push(file); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }

  if (command === 'plan') {
    console.log(`Canonical baseline ready: ${path.relative(repoRoot, baseline)}`);
    console.log(`Legacy files to archive: ${existing.length}/${legacyFiles.length}`);
    for (const file of existing) console.log(`  ${file} -> ${path.relative(repoRoot, path.join(archiveDir, file))}`);
    if (existing.length !== legacyFiles.length) throw new Error(`Expected ${legacyFiles.length} legacy migration files, found ${existing.length}.`);
    return;
  }

  if (command !== 'apply') throw new Error('Usage: activate-canonical-baseline.mjs {plan|apply}');
  assertCleanGitTree();
  if (existing.length !== legacyFiles.length) throw new Error(`Expected ${legacyFiles.length} legacy migration files, found ${existing.length}.`);

  await mkdir(archiveDir, { recursive: true });
  for (const file of existing) {
    const source = path.join(migrationDir, file);
    const target = path.join(archiveDir, file);
    try { await access(target); throw new Error(`Archive target already exists: ${target}`); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    await rename(source, target);
  }

  console.log('Canonical baseline activation layout completed. Review the git rename diff, run the disposable baseline gate, and commit before any Production history repair.');
}

await main();
