import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/solmint-pay-production-migration.yml', 'utf8');

test('Production migration workflow exposes an explicit read-only dry-run mode', () => {
  assert.match(workflow, /- 'NO'[\s\S]*- 'DRY_RUN'[\s\S]*- 'APPLY'/);
  assert.match(workflow, /if: inputs\.confirm == 'APPLY' \|\| inputs\.confirm == 'DRY_RUN'/);
  assert.match(workflow, /supabase db push --db-url "\$SUPABASE_DB_URL" --dry-run/);
  assert.match(workflow, /name: Apply pending migrations\s+if: inputs\.confirm == 'APPLY'/);
  assert.match(workflow, /supabase migration list --db-url "\$SUPABASE_DB_URL"/);
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
  assert.match(workflow, /embedded_password=/);
  assert.doesNotMatch(workflow, /aws-0-eu-central-1\.pooler\.supabase\.com/);
});
