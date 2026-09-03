#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [snapshotArg] = process.argv.slice(2);
const snapshotPath = snapshotArg || 'production-schema.sql';
const outputPath = path.resolve('supabase/migrations/20260829090000_solmint_production_baseline.sql');
const expectedHash = '553d0f9a34f52ef344471c45398c41780438c0dbeec5d6cc63c912d6a8b223c5';

const snapshot = await readFile(path.resolve(snapshotPath), 'utf8');
const actualHash = createHash('sha256').update(snapshot).digest('hex');
if (actualHash !== expectedHash) throw new Error(`Snapshot SHA-256 mismatch: expected ${expectedHash}, got ${actualHash}`);
if (/^(?:INSERT\s+INTO|COPY\s+[^\n]+\s+FROM\s+stdin)\b/im.test(snapshot)) throw new Error('Snapshot contains top-level data-import statements.');
if (/(?:postgres(?:ql)?:\/\/|PASSWORD\s*=|SUPABASE_(?:SERVICE_ROLE|SECRET)_KEY\s*=)/i.test(snapshot)) throw new Error('Snapshot appears to contain credentials.');

try {
  await access(outputPath);
  throw new Error(`Refusing to overwrite existing baseline: ${outputPath}`);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const header = `-- SolMint Pay canonical production baseline.\n-- Source snapshot SHA-256: ${expectedHash}\n-- Captured from Production project nvopkbiedorfshwbmyhn on 2026-09-03.\n-- This migration is the exact captured PostgreSQL schema and contains no production data.\n-- It must be activated only after disposable replay/equivalence validation and guarded migration-history repair.\n-- SOLMINT_PAY_BASELINE_START\n`;
const footer = `\n-- SOLMINT_PAY_BASELINE_END\n`;
await writeFile(outputPath, `${header}${snapshot.trim()}${footer}`, 'utf8');
console.log(`Created ${outputPath} from ${snapshotPath}; SHA-256 ${actualHash}`);
