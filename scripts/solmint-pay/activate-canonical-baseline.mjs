#!/usr/bin/env node
import { access, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const migrationDir = path.join(repoRoot, 'supabase/migrations');
const archiveDir = path.join(repoRoot, 'supabase/migration-archive/legacy-2026-09-03');
const baseline = path.join(migrationDir, '20260829090000_solmint_production_baseline.sql');
const legacyFiles = [
  '20260805_harden_rls_and_article_timestamps.sql',
  '20260807_comments_production_interactions.sql',
  '20260807_comments_security_hardening.sql',
  '20260807_harden_article_seo_fields.sql',
  '20260807_harden_blog_comments.sql',
  '20260807_production_comments.sql',
  '20260810_add_server_auth_sessions.sql',
  '20260812_comments_final_production_hardening.sql',
  '20260812_harden_comment_votes_and_rate_limits.sql',
  '20260813_add_solana_projects_category.sql',
  '20260817_add_article_localization_fields.sql',
  '20260818_drop_duplicate_article_translation_index.sql',
  '20260826_enforce_category_default_cover_on_articles.sql',
  '20260826_category_default_media_gallery.sql',
];

const [command = 'plan'] = process.argv.slice(2);

function assertCleanGitTree() {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  if (status) throw new Error('Refusing activation with an uncommitted working tree.');
}

function assertPayChain() {
  const entries = execFileSync('bash', ['-lc', "find supabase/migrations -maxdepth 1 -type f -name '*_solmint_pay_*.sql' -print | sort"], { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  if (entries.length !== 47) throw new Error(`Expected exactly 47 active Pay migrations, found ${entries.length}.`);
}

async function main() {
  await access(baseline);
  const validator = path.join(repoRoot, 'scripts/solmint-pay/baseline-validate.mjs');
  execFileSync(process.execPath, [validator, baseline], { cwd: repoRoot, stdio: 'inherit' });
  assertPayChain();

  const existing = [];
  for (const file of legacyFiles) {
    const source = path.join(migrationDir, file);
    try { await access(source); existing.push(file); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }

  if (existing.length !== legacyFiles.length) throw new Error(`Expected ${legacyFiles.length} legacy migration files, found ${existing.length}.`);
  if (command === 'plan') {
    console.log(`Canonical baseline ready: ${path.relative(repoRoot, baseline)}`);
    console.log(`Legacy files ready to archive: ${existing.length}`);
    return;
  }
  if (command !== 'apply') throw new Error('Usage: activate-canonical-baseline.mjs {plan|apply}');
  assertCleanGitTree();
  await mkdir(archiveDir, { recursive: true });
  for (const file of existing) {
    const source = path.join(migrationDir, file);
    const target = path.join(archiveDir, file);
    try { await access(target); throw new Error(`Archive target already exists: ${target}`); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    await rename(source, target);
  }
  console.log('Canonical baseline active-migration layout completed.');
}

await main();
