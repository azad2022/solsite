#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:?PGHOST must point to the isolated PostgreSQL test service}"
: "${PGPORT:?PGPORT must point to the isolated PostgreSQL test service}"
: "${PGUSER:?PGUSER must identify the disposable test database user}"
: "${PGPASSWORD:?PGPASSWORD must identify the disposable test database password}"
: "${PGDATABASE:?PGDATABASE must be the isolated Payment Link upgrade test database}"

# This link is created only in the disposable database prepared by the prior SQL test.
psql -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
DO $concurrency_link$
DECLARE
  v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims','{"solmint_user_id":"upgrade-owner"}',true);
  v := public.pay_create_payment_link(
    '00000000-0000-0000-0000-000000000001',
    'upgrade-concurrency',
    'Concurrent capacity fixture',
    NULL,
    1000000,
    'USDC',
    'merchant',
    'en-US',
    NULL,
    'create-upgrade-concurrency-1',
    repeat('9',64),
    NULL,
    1,
    '[]'::jsonb
  );
  IF v->>'state' <> 'created' THEN
    RAISE EXCEPTION 'concurrency fixture Payment Link creation failed: %', v;
  END IF;
END;
$concurrency_link$;
COMMIT;
SQL

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

run_attempt() {
  local idempotency_key="$1"
  local request_hash="$2"
  local reference="$3"
  local output_file="$4"

  psql -X -qAt -v ON_ERROR_STOP=1 -c "
    BEGIN;
    SET LOCAL ROLE service_role;
    SELECT (
      public.pay_create_payment_intent_from_link(
        (SELECT id FROM public.pay_payment_links WHERE slug='upgrade-concurrency'),
        '00000000-0000-0000-0000-000000000001'::uuid,
        1000000,
        'USDC',
        NULL,
        NULL,
        NULL,
        'recipient',
        '${reference}',
        100,
        'merchant',
        10000,
        1000000,
        990000,
        'fee-recipient',
        'solana',
        now()+interval '10 minutes',
        '{}'::jsonb,
        '${idempotency_key}',
        '${request_hash}',
        'payment-intents:link',
        'Ali',
        'Ahmadi',
        'Concurrent order',
        '{}'::jsonb
      )
    )->>'state';
    COMMIT;
  " > "$output_file"
}

# Start two distinct idempotency keys in separate PostgreSQL sessions simultaneously.
run_attempt "capacity-concurrency-1" "$(printf 'a%.0s' {1..64})" "ConcurrentReferenceAlpha123456789" "$tmp_dir/one" &
pid_one=$!
run_attempt "capacity-concurrency-2" "$(printf 'b%.0s' {1..64})" "ConcurrentReferenceBeta1234567890" "$tmp_dir/two" &
pid_two=$!

wait "$pid_one"
wait "$pid_two"

state_one="$(tail -n 1 "$tmp_dir/one" | tr -d '\r')"
state_two="$(tail -n 1 "$tmp_dir/two" | tr -d '\r')"
states="$(printf '%s\n%s\n' "$state_one" "$state_two" | sort)"
expected="$(printf 'capacity_reached\ncreated')"

if [[ "$states" != "$expected" ]]; then
  printf 'Expected exactly one created and one capacity_reached state. Got: [%s], [%s]\n' "$state_one" "$state_two" >&2
  exit 1
fi

active_count="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "
  SELECT count(*)
  FROM public.pay_payment_intents
  WHERE payment_link_id=(SELECT id FROM public.pay_payment_links WHERE slug='upgrade-concurrency')
    AND (
      status='completed'
      OR (status IN ('created','pending','detected','verifying','confirmed') AND expires_at > now())
    );
")"
if [[ "$active_count" != "1" ]]; then
  printf 'Expected exactly one active/completed Payment Intent reservation, found %s\n' "$active_count" >&2
  exit 1
fi

printf 'payment_link_capacity_concurrency_ok states=[%s,%s] active_count=%s\n' "$state_one" "$state_two" "$active_count"
