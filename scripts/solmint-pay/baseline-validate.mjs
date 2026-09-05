#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const [baselinePath = 'supabase/migrations/20260829090000_solmint_production_baseline.sql'] = process.argv.slice(2);
const baseline = await readFile(path.resolve(baselinePath), 'utf8');
const expectedHash = '553d0f9a34f52ef344471c45398c41780438c0dbeec5d6cc63c912d6a8b223c5';
if (!baseline.includes(`Source snapshot SHA-256: ${expectedHash}`)) throw new Error('Baseline is not pinned to the audited production snapshot.');
if (!baseline.includes('SOLMINT_PAY_BASELINE_START') || !baseline.includes('SOLMINT_PAY_BASELINE_END')) throw new Error('Baseline boundary markers are missing.');
if (/^(?:INSERT\s+INTO|COPY\s+[^\n]+\s+FROM\s+stdin)\b/im.test(baseline)) throw new Error('Baseline contains top-level data-import statements.');
if (/(?:postgres(?:ql)?:\/\/|PASSWORD\s*=|SUPABASE_(?:SERVICE_ROLE|SECRET)_KEY\s*=)/i.test(baseline)) throw new Error('Baseline appears to contain credentials.');
console.log(JSON.stringify({ ok: true, baselineBytes: Buffer.byteLength(baseline, 'utf8'), baselineVersion: '20260829090000', firstPayMigration: '20260830000050' }, null, 2));
