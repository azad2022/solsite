#!/usr/bin/env python3
from pathlib import Path
import difflib
import hashlib
import re
import sys

SNAPSHOT = Path('artifacts/solmint-pay-replay/input/production-schema.sql')
REPLAY = Path('artifacts/solmint-pay-replay/replayed-schema.sql')
REPORT = Path('artifacts/solmint-pay-replay/equivalence-report.md')
DIFF = Path('artifacts/solmint-pay-replay/equivalence-diff.txt')

IGNORE_LINE_PATTERNS = (
    r'^SET\s',
    r'^SELECT pg_catalog\.set_config',
    r'^CREATE EXTENSION IF NOT EXISTS ',
    r'^ALTER EXTENSION ',
    r'^COMMENT ON EXTENSION ',
    r'^ALTER (SCHEMA|TABLE|FUNCTION) .* OWNER TO ',
    r'^GRANT ',
    r'^REVOKE ',
    r'^ALTER DEFAULT PRIVILEGES ',
    r'^ALTER PUBLICATION ',
    r'^CREATE PUBLICATION ',
)


def transform_outside_literals(text: str) -> str:
    """Normalize whitespace and simple quoted identifiers without touching SQL literals."""
    out: list[str] = []
    i = 0
    in_single = False
    dollar_tag: str | None = None
    whitespace_pending = False

    while i < len(text):
        if dollar_tag is not None:
            end = text.find(dollar_tag, i)
            if end == -1:
                out.append(text[i:])
                break
            out.append(text[i:end + len(dollar_tag)])
            i = end + len(dollar_tag)
            dollar_tag = None
            continue

        if in_single:
            ch = text[i]
            out.append(ch)
            if ch == "'":
                if i + 1 < len(text) and text[i + 1] == "'":
                    out.append("'")
                    i += 2
                    continue
                in_single = False
            i += 1
            continue

        if text[i] == "'":
            if whitespace_pending and out and out[-1] != ' ':
                out.append(' ')
            whitespace_pending = False
            out.append("'")
            in_single = True
            i += 1
            continue

        if text[i] == '$':
            m = re.match(r'\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$', text[i:])
            if m:
                if whitespace_pending and out and out[-1] != ' ':
                    out.append(' ')
                whitespace_pending = False
                tag = m.group(0)
                out.append(tag)
                i += len(tag)
                dollar_tag = tag
                continue

        ch = text[i]
        if ch.isspace():
            whitespace_pending = True
            i += 1
            continue

        if whitespace_pending and out and out[-1] not in ' (.,;':
            out.append(' ')
        whitespace_pending = False

        # pg_dump may quote simple identifiers in the source snapshot but omit
        # quotes in the regenerated dump. Normalize only safe identifier tokens.
        if ch == '"':
            end = text.find('"', i + 1)
            if end != -1:
                ident = text[i + 1:end]
                if re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', ident):
                    out.append(ident)
                    i = end + 1
                    continue

        out.append(ch)
        i += 1

    result = ''.join(out)
    result = re.sub(r'\s+;', ';', result)
    result = re.sub(r';\s*', ';\n', result)
    return result.strip() + '\n'


def canonicalize(text: str) -> str:
    kept: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith('--') or line.startswith('\\'):
            continue
        if any(re.match(pattern, line, re.I) for pattern in IGNORE_LINE_PATTERNS):
            continue
        line = re.sub(r'^CREATE TABLE IF NOT EXISTS ', 'CREATE TABLE ', line, flags=re.I)
        line = re.sub(r'^CREATE SCHEMA IF NOT EXISTS ', 'CREATE SCHEMA ', line, flags=re.I)
        kept.append(line)
    return transform_outside_literals('\n'.join(kept))


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
    DIFF.write_text('\n'.join(diff[:1000]) + '\n', encoding='utf-8')
    lines += [
        'The canonicalized SQL differs. A bounded unified diff was written to `equivalence-diff.txt`.',
        '',
        '## Interpretation',
        '',
        '`FAIL` means the snapshot did not reproduce the same canonical SQL under the current PostgreSQL fixture. This is a test failure, not permission to alter Production.',
        '',
    ]
else:
    lines += [
        'The canonicalized schema matched after replay, excluding deployment-environment metadata intentionally removed by this comparator (owners, ACLs, unsupported platform extensions, and realtime publication metadata).',
        '',
        '## Interpretation',
        '',
        '`PASS` means the captured production DDL is replayable and equivalent at the canonical PostgreSQL schema level in the disposable fixture.',
        '',
    ]

REPORT.write_text('\n'.join(lines), encoding='utf-8')
print('\n'.join(lines))
if not same:
    sys.exit(1)
