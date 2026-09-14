#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
expected="$root/docs/solmint-pay-live-migration-ledger.txt"
active_dir="$root/supabase/migrations"
tmp_expected="$(mktemp)"
tmp_actual="$(mktemp)"
trap 'rm -f "$tmp_expected" "$tmp_actual"' EXIT

if [[ ! -f "$expected" ]]; then
  echo "Missing migration ledger: $expected" >&2
  exit 1
fi

sed '/^[[:space:]]*#/d;/^[[:space:]]*$/d' "$expected" | sort > "$tmp_expected"
find "$active_dir" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort > "$tmp_actual"

expected_count="$(wc -l < "$tmp_expected" | tr -d ' ')"
actual_count="$(wc -l < "$tmp_actual" | tr -d ' ')"

if [[ "$expected_count" != "$actual_count" ]]; then
  echo "Migration count mismatch: expected $expected_count, found $actual_count" >&2
  diff -u "$tmp_expected" "$tmp_actual" || true
  exit 1
fi

if ! cmp -s "$tmp_expected" "$tmp_actual"; then
  echo "Active migration filenames do not match the production-recorded ledger." >&2
  diff -u "$tmp_expected" "$tmp_actual" || true
  exit 1
fi

# Guard against duplicate timestamps and malformed migration filenames.
if awk -F_ 'length($1) == 14 { count[$1]++ } END { for (k in count) if (count[k] > 1) { print "duplicate migration timestamp: " k > "/dev/stderr"; bad=1 } exit bad }' "$tmp_actual"; then
  :
else
  exit 1
fi

if grep -Evq '^[0-9]{14}_[A-Za-z0-9][A-Za-z0-9._-]*\.sql$' "$tmp_actual"; then
  echo "Malformed migration filename detected." >&2
  exit 1
fi

echo "Migration chain integrity check passed: $actual_count active migration files match the recorded production ledger."
