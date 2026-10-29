import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/solmint-pay-production-migration.yml', 'utf8');

test('Production migration workflow exposes an explicit read-only dry-run mode', () => {
  assert.match(workflow, /- 'NO'[\s\S]*- 'DRY_RUN'[\s\S]*- 'APPLY'/);
  assert.match(workflow, /if: inputs\.confirm == 'APPLY' \|\| inputs\.confirm == 'DRY_RUN'/);
  assert.match(workflow, /supabase db push --db-url "\$SUPABASE_DB_URL_SANITIZED" --dry-run/);
  assert.match(workflow, /name: Apply pending migrations\s+if: inputs\.confirm == 'APPLY'/);
  assert.match(workflow, /supabase migration list --db-url "\$SUPABASE_DB_URL_SANITIZED"/);
  assert.match(workflow, /permissions:\s+contents: read/);
});

test('A DRY_RUN cannot execute the migration apply step', () => {
  const applyStep = workflow.match(/- name: Apply pending migrations([\s\S]*?)(?=\n      - name:|$)/);
  assert.ok(applyStep, 'apply step must remain present');
  assert.match(applyStep[1], /if: inputs\.confirm == 'APPLY'/);
  assert.doesNotMatch(applyStep[1], /if: inputs\.confirm == 'APPLY' \|\| inputs\.confirm == 'DRY_RUN'/);
});


test('Production migration uses the repository-supplied Supabase connection URI', () => {
  assert.match(workflow, /SUPABASE_DB_URL:\s+\$\{\{\s*secrets\.SUPABASE_DB_URL\s*\}\}/);
  assert.match(workflow, /new URL\(raw\)/);
  assert.match(workflow, /embedded_password_removed=/);
  assert.doesNotMatch(workflow, /aws-0-eu-central-1\.pooler\.supabase\.com/);
});

test('Connection URL password is removed before CLI calls and the password secret is authoritative', () => {
  assert.match(workflow, /SUPABASE_DB_URL:\s+\$\{\{\s*secrets\.SUPABASE_DB_URL\s*\}\}/);
  assert.match(workflow, /uri\.password = ''/);
  assert.match(workflow, /SUPABASE_DB_URL_SANITIZED=/);
  assert.match(workflow, /PGPASSWORD:\s+\$\{\{\s*secrets\.SUPABASE_DB_PASSWORD\s*\}\}/);
  assert.match(workflow, /supabase db push --db-url "\$SUPABASE_DB_URL_SANITIZED" --dry-run/);
  assert.doesNotMatch(workflow, /aws-0-eu-central-1\.pooler\.supabase\.com/);
});
