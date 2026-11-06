import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/solmint-pay-production-migration.yml', 'utf8');
const migrationGuard = readFileSync('scripts/solmint-pay-production-migration-guard.mjs', 'utf8');

test('Production migration workflow exposes explicit read-only and mutating modes', () => {
  assert.match(workflow, /- 'NO'[\s\S]*- 'DRY_RUN'[\s\S]*- 'APPLY'/);
  assert.match(workflow, /if: inputs\.confirm == 'APPLY' \|\| inputs\.confirm == 'DRY_RUN' \|\| inputs\.confirm == 'AUTH_PROBE'/);
  assert.match(workflow, /supabase db push --db-url "\$SUPABASE_DB_URL_SANITIZED" --dry-run/);
  assert.match(workflow, /name: Apply pending migrations\s+if: inputs\.confirm == 'APPLY'/);
  assert.match(workflow, /supabase migration list --db-url "\$SUPABASE_DB_URL_SANITIZED"/);
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /expected_main_sha:/);
  assert.match(workflow, /node scripts\/solmint-pay-production-migration-guard\.mjs assert-apply-ref/);
});

test('A DRY_RUN cannot execute the migration apply step', () => {
  const applyStep = workflow.match(/- name: Apply pending migrations([\s\S]*?)(?=\n      - name:|$)/);
  assert.ok(applyStep, 'apply step must remain present');
  assert.match(applyStep[1], /if: inputs\.confirm == 'APPLY'/);
  assert.doesNotMatch(applyStep[1], /if: inputs\.confirm == 'APPLY' \|\| inputs\.confirm == 'DRY_RUN'/);
});

test('Production database URL guard binds the exact Supabase Session Pooler target', () => {
  assert.match(workflow, /SUPABASE_DB_URL:\s+\$\{\{\s*secrets\.SUPABASE_DB_URL\s*\}\}/);
  assert.match(workflow, /node scripts\/solmint-pay-production-migration-guard\.mjs validate-target/);
  assert.ok(migrationGuard.includes('new URL(databaseUrl)'));
  assert.ok(migrationGuard.includes('hostname.endsWith(POOLER_SUFFIX)'));
  assert.ok(migrationGuard.includes('username !=='));
  assert.ok(migrationGuard.includes('url.pathname !== "/postgres"'));
  assert.ok(migrationGuard.includes('url.password = "";'));
  assert.doesNotMatch(workflow, /aws-0-eu-central-1\.pooler\.supabase\.com/);
});

test('Connection URI password is removed and standalone secret is authoritative', () => {
  assert.match(workflow, /SUPABASE_DB_URL_SANITIZED/);
  assert.match(workflow, /PGPASSWORD:\s+\$\{\{\s*secrets\.SUPABASE_DB_PASSWORD\s*\}\}/);
  assert.ok(migrationGuard.includes('decodedPassword !== standalonePassword'));
  assert.match(migrationGuard, /Error messages are deliberately constant/);
  assert.match(migrationGuard, /console\.error\(error instanceof Error \? error\.message/);
  assert.match(workflow, /supabase db push --db-url "\$SUPABASE_DB_URL_SANITIZED" --dry-run/);
});

test('Production APPLY is limited to an exact confirmed main commit', () => {
  assert.ok(migrationGuard.includes('eventName !== "workflow_dispatch"'));
  assert.ok(migrationGuard.includes('ref !== "refs/heads/main"'));
  assert.ok(migrationGuard.includes('sha.toLowerCase() !== expectedSha.toLowerCase()'));
  assert.match(workflow, /EXPECTED_MAIN_SHA:\s+\$\{\{\s*inputs\.expected_main_sha\s*\}\}/);
});

test('Production migration workflow uses an exact, non-moving Supabase CLI version', () => {
  assert.match(workflow, /version: 2\.122\.1/);
  assert.doesNotMatch(workflow, /version:\s*latest/);
});
