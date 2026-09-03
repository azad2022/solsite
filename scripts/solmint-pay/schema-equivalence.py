#!/usr/bin/env python3
from pathlib import Path
import difflib
import hashlib
import re
import sys

SNAPSHOT = Path('artifacts/solmint-pay-replay/input/production-schema.sql')
REPLAY = Path('artifacts/solmint-pay-replay/replayed-schema.sql')
REPORT = Path('artifacts/solmint-pay-replay/equivalence-report.md')


def canonicalize(text: str) -> str:
    out = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith('--') or line.startswith('\\'):
            continue
        if line.startswith('SET ') or line.startswith('SELECT pg_catalog.set_config'):
            continue
        if re.match(r'^CREATE EXTENSION IF NOT EXISTS ', line):
            continue
        if re.match(r'^ALTER EXTENSION ', line):
            continue
        if re.match(r'^COMMENT ON EXTENSION ', line):
            continue
        if re.match(r'^ALTER (SCHEMA|TABLE|FUNCTION) .* OWNER TO ', line):
            continue
        if re.match(r'^GRANT ', line) or re.match(r'^REVOKE ', line):
            continue
        if re.match(r'^ALTER DEFAULT PRIVILEGES ', line):
            continue
        if re.match(r'^ALTER PUBLICATION ', line) or re.match(r'^CREATE PUBLICATION ', line):
            continue
        line = line.replace('CREATE TABLE IF NOT EXISTS ', 'CREATE TABLE ')
        line = line.replace('CREATE SCHEMA IF NOT EXISTS ', 'CREATE SCHEMA ')
        out.append(line)
    return '\n'.join(out).strip() + '\n'


def digest(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


src_raw = SNAPSHOT.read_text(encoding='utf-8')
replay_raw = REPLAY.read_text(encoding='utf-8')
src = canonicalize(src_raw)
replay = canonicalize(replay_raw)
REPORT.parent.mkdir(parents=True, exist_ok=True)

same = src == replay
src_sha = digest(src)
replay_sha = digest(replay)

lines = [
    '# SolMint Pay — Snapshot Replay Equivalence',
    '',
    '## Canonical SQL equivalence',
    '',
    f'- Snapshot canonical SHA-256: `{src_sha}`',
    f'- Replay canonical SHA-256: `{replay_sha}`',
    f'- Result: `{"PASS" if same else "FAIL"}`',
    '',
]

if not same:
    diff = list(difflib.unified_diff(
        src.splitlines(), replay.splitlines(),
        fromfile='snapshot', tofile='replay', n=3,
    ))
    REPORT.with_name('equivalence-diff.txt').write_text('\n'.join(diff[:400]) + '\n', encoding='utf-8')
    lines += [
        'The canonicalized SQL differs. A bounded unified diff was written to `equivalence-diff.txt`.',
        '',
        '## Interpretation',
        '',
        '`FAIL` means the snapshot did not replay to the same canonical PostgreSQL schema under the current fixture. It does not authorize production migration changes.',
        '',
    ]
else:
    lines += [
        'The full canonicalized schema matched after replay, excluding deployment-environment metadata intentionally removed by this comparator (owners, ACLs, unsupported platform extensions, and realtime publication ownership).',
        '',
        '## Interpretation',
        '',
        '`PASS` means the captured production DDL is replayable and structurally equivalent at the canonical PostgreSQL schema level in the disposable fixture.',
        '',
    ]

REPORT.write_text('\n'.join(lines), encoding='utf-8')
print('\n'.join(lines))
if not same:
    sys.exit(1)
