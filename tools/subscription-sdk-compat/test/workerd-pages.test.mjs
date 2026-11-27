import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const wrangler = join(packageRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');
const port = 8792;
const endpoint = `http://127.0.0.1:${port}/api/runtime-probe`;

test('pinned Subscription SDK imports and builds an instruction in local Pages Workerd', { timeout: 90_000 }, async () => {
  const child = spawn(wrangler, [
    'pages', 'dev', 'public',
    '--ip', '127.0.0.1',
    '--port', String(port),
    '--log-level', 'info',
  ], {
    cwd: packageRoot,
    env: {
      ...process.env,
      CI: '1',
      WRANGLER_SEND_METRICS: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { output = (output + chunk).slice(-20_000); });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { output = (output + chunk).slice(-20_000); });

  try {
    const deadline = Date.now() + 65_000;
    let response;
    let lastConnectionError = 'server not ready';

    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(`Wrangler exited with code ${child.exitCode}.\n${output}`);
      }

      try {
        const candidate = await fetch(endpoint, { signal: AbortSignal.timeout(3_000) });
        if (candidate.status === 200 || candidate.status >= 500) {
          response = candidate;
          break;
        }
        lastConnectionError = `HTTP ${candidate.status}`;
      } catch (error) {
        lastConnectionError = error instanceof Error ? error.message : String(error);
      }
      await delay(300);
    }

    if (!response) {
      throw new Error(`Pages Workerd did not become ready: ${lastConnectionError}.\n${output}`);
    }

    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.ok, true);
    assert.equal(body.runtime, 'cloudflare-pages-functions-workerd');
    assert.equal(body.compatibilityDate, '2026-08-10');
    assert.deepEqual(body.nodeBuiltins, {
      events: true,
      path: true,
      fsPromises: true,
      buffer: true,
    });
    assert.equal(body.instruction.programId, 'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44');
    assert.ok(Number.isInteger(body.instruction.discriminator));
    assert.ok(body.instruction.dataLength > 0);
    assert.ok(body.instruction.accountCount > 0);
  } catch (error) {
    if (error instanceof Error) error.message += `\nWrangler output:\n${output}`;
    throw error;
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit').catch(() => undefined);
      child.kill('SIGTERM');
      await Promise.race([exited, delay(5_000)]);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  }
});
