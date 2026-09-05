#!/usr/bin/env bash
set -Eeuo pipefail

# Read-only production schema capture for SolMint Pay migration-baseline recovery.
# Requires SUPABASE_DB_URL in the calling environment. Never prints the URL.
# This command performs a schema-only dump and does not modify the remote database.

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL must be set to the production Postgres connection string}"

command -v supabase >/dev/null 2>&1 || {
  echo "supabase CLI is required" >&2
  exit 1
}

out_dir="${1:-artifacts/solmint-pay-production-schema}"
mkdir -p "$out_dir"

umask 077
schema_file="$out_dir/production-schema.sql"
metadata_file="$out_dir/production-schema.sha256"

rm -f "$schema_file" "$metadata_file"

# Supabase's db dump uses pg_dump with Supabase-specific filtering and produces
# a schema-only artifact by default. It does not write migration-history rows.
supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  --file "$schema_file"

[ -s "$schema_file" ] || {
  echo "schema dump is empty; refusing to produce a baseline artifact" >&2
  exit 1
}

sha256sum "$schema_file" > "$metadata_file"
printf 'Captured schema artifact: %s\n' "$schema_file"
printf 'SHA-256 manifest: %s\n' "$metadata_file"
