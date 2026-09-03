#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LEDGER_FILE="$REPO_ROOT/docs/solmint-pay-supabase-production-migration-ledger-2026-09-03.txt"
BASELINE_FILE="$REPO_ROOT/supabase/migrations/20260829090000_solmint_production_baseline.sql"
BASELINE_VERSION="20260829090000"
EXPECTED_LEDGER_ENTRIES=56
EXPECTED_LEDGER_SHA="23620cfd252215c972f7c8f295a913cf1cdaf77a"
STATE_FILE="${SOLMINT_PAY_REPAIR_STATE_FILE:-$REPO_ROOT/.git/solmint-pay-migration-repair.state}"
action="${1:-plan}"
ledger_versions() { awk '/^[0-9]{14} / {print $1}' "$LEDGER_FILE"; }
sha256_file() { if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'; else sha256sum "$1" | awk '{print $1}'; fi; }
validate_inputs() {
  [[ -f "$LEDGER_FILE" ]] || { echo "Refusing: production ledger manifest is missing" >&2; exit 1; }
  [[ -f "$BASELINE_FILE" ]] || { echo "Refusing: canonical baseline file is missing" >&2; exit 1; }
  node "$REPO_ROOT/scripts/solmint-pay/baseline-validate.mjs" "$BASELINE_FILE" >/dev/null
  mapfile -t versions < <(ledger_versions)
  [[ "${#versions[@]}" -eq "$EXPECTED_LEDGER_ENTRIES" ]] || { echo "Refusing: ledger entry count is ${#versions[@]}, expected $EXPECTED_LEDGER_ENTRIES" >&2; exit 1; }
  actual_sha="$(sha256_file "$LEDGER_FILE")"
  [[ "$actual_sha" == "$EXPECTED_LEDGER_SHA" ]] || { echo "Refusing: ledger manifest SHA mismatch: $actual_sha" >&2; exit 1; }
}
require_guard() {
  [[ "${SUPABASE_PROJECT_REF:-}" == "nvopkbiedorfshwbmyhn" ]] || { echo "Refusing: SUPABASE_PROJECT_REF must be nvopkbiedorfshwbmyhn" >&2; exit 1; }
  [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]] || { echo "Refusing: SUPABASE_ACCESS_TOKEN is required" >&2; exit 1; }
  [[ "${CONFIRM_PROD_MIGRATION_REPAIR:-}" == "I_UNDERSTAND_METADATA_ONLY" ]] || { echo "Refusing: set CONFIRM_PROD_MIGRATION_REPAIR=I_UNDERSTAND_METADATA_ONLY" >&2; exit 1; }
}
validate_inputs
case "$action" in
  plan)
    echo "Plan only. No remote mutation will occur."
    echo "Project: ${SUPABASE_PROJECT_REF:-<set only for an authenticated production run>}"
    echo "Historical versions to retire: $EXPECTED_LEDGER_ENTRIES"
    echo "Canonical baseline: $BASELINE_VERSION"
    echo "Forward: historical versions -> reverted; canonical baseline -> applied."
    echo "Rollback: canonical baseline -> reverted; historical versions -> applied in original order."
    echo "Important: migration repair changes tracking metadata only; it does not execute or revert schema SQL."
    ;;
  apply)
    require_guard
    [[ ! -e "$STATE_FILE" ]] || { echo "Refusing: repair state already exists at $STATE_FILE" >&2; exit 1; }
    mkdir -p "$(dirname "$STATE_FILE")"
    printf 'baseline=%s\nledger_sha=%s\n' "$BASELINE_VERSION" "$EXPECTED_LEDGER_SHA" > "$STATE_FILE"
    completed=0
    rollback_on_error() { set +e; for ((i=completed-1; i>=0; i--)); do supabase migration repair --project-ref "$SUPABASE_PROJECT_REF" --status applied "${versions[$i]}" >/dev/null; done; rm -f "$STATE_FILE"; exit 1; }
    trap rollback_on_error ERR
    for version in "${versions[@]}"; do supabase migration repair --project-ref "$SUPABASE_PROJECT_REF" --status reverted "$version"; completed=$((completed+1)); done
    supabase migration repair --project-ref "$SUPABASE_PROJECT_REF" --status applied "$BASELINE_VERSION"
    printf 'completed=%s\n' "$completed" >> "$STATE_FILE"
    trap - ERR
    echo "Migration history repaired to canonical baseline. Schema SQL was not executed by migration repair."
    ;;
  rollback)
    require_guard
    [[ -f "$STATE_FILE" ]] || { echo "Refusing: no repair state file" >&2; exit 1; }
    supabase migration repair --project-ref "$SUPABASE_PROJECT_REF" --status reverted "$BASELINE_VERSION"
    applied=0
    rollback_forward_on_error() { set +e; for ((i=applied-1; i>=0; i--)); do supabase migration repair --project-ref "$SUPABASE_PROJECT_REF" --status reverted "${versions[$i]}" >/dev/null; done; exit 1; }
    trap rollback_forward_on_error ERR
    for version in "${versions[@]}"; do supabase migration repair --project-ref "$SUPABASE_PROJECT_REF" --status applied "$version"; applied=$((applied+1)); done
    trap - ERR
    rm -f "$STATE_FILE"
    echo "Migration history rolled back to the captured historical ledger."
    ;;
  *) echo "Usage: $0 {plan|apply|rollback}" >&2; exit 2;;
esac
