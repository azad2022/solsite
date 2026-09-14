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

if (( actual_count < expected_count )); then
  echo "Migration count mismatch: production ledger has $expected_count entries, repository has only $actual_count active migrations." >&2
  diff -u "$tmp_expected" "$tmp_actual" || true
  exit 1
fi

# Every migration recorded as applied in Production must exist under its exact
# historical filename. Additional migrations are allowed only when their version
# is strictly newer than the latest Production-applied version; these are pending
# repository migrations and must not be mistaken for applied production history.
while IFS= read -r expected_name; do
  if [[ ! -f "$active_dir/$expected_name" ]]; then
    echo "Missing production migration: $expected_name" >&2
    exit 1
  fi
done < "$tmp_expected"

max_expected_version="$(awk -F_ 'BEGIN { max="" } /^[0-9]{14}_/ { if ($1 > max) max=$1 } END { print max }' "$tmp_expected")"

while IFS= read -r actual_name; do
  actual_version="${actual_name%%_*}"
  if [[ "$actual_version" == "$actual_name" ]]; then
    echo "Malformed migration filename detected: $actual_name" >&2
    exit 1
  fi
  if [[ "$actual_version" =~ ^[0-9]{14}$ ]] && [[ "$actual_version" <="$max_expected_version" ]]; then
    if ! grep -Fqx "$actual_name" "$tmp_expected"; then
      echo "Unexpected non-production migration at or before the production ledger boundary: $actual_name" >&2
      exit 1
    fi
  elif [[ ! "$actual_version" =~ ^[0-9]{14}$ ]]; then
    echo "Malformed migration filename detected: $actual_name" >&2
    exit 1
  fi
done < "$tmp_actual"

if awk -F_ 'length($1) == 14 { count[$1]++ } END { for (k in count) if (count[k] > 1) { print "duplicate migration timestamp: " k > "/dev/stderr"; bad=1 } exit bad }' "$tmp_actual"; then
  :
else
  exit 1
fi

if grep -Evq '^[0-9]{14}_[A-Za-z0-9][A-Za-z0-9._-]*\.sql$' "$tmp_actual"; then
  echo "Malformed migration filename detected." >&2
  exit 1
fi

pending_count=$((actual_count - expected_count))
echo "Migration chain integrity check passed: $expected_count production migrations match exactly; $pending_count pending migration(s) are newer than the recorded production ledger."
