import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflowPaths = [
  '../.github/workflows/solmint-pay-live-audit.yml',
  '../.github/workflows/solmint-pay-production-browser-ui.yml',
];

test('Pay production browser workflows use a valid YAML block for the isolated Chromium installer', () => {
  for (const path of workflowPaths) {
    const workflow = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.ok(
      workflow.includes('run: |\n          "$RUNNER_TEMP/pay-playwright/node_modules/.bin/playwright" install --with-deps chromium'),
      path + ' must use a literal YAML block for the quoted Playwright command.',
    );
    assert.ok(
      !workflow.includes('run: "$RUNNER_TEMP/pay-playwright/node_modules/.bin/playwright" install --with-deps chromium'),
      path + ' must not place shell arguments after a closed YAML quoted scalar.',
    );
    assert.ok(workflow.includes('bun install --frozen-lockfile'), path + ' must use the lockfile-pinned dependency install.');
  }
});
