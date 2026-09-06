# SolMint Pay — Backend Exposure Gates

These gates are derived from the live Supabase project and the repository state observed on 2026-09-06.

## Gate A — RLS / tenant isolation

Live inspection of `pg_policies` returned no policies for the `pay_*` tables. RLS being enabled is therefore not sufficient evidence for browser-facing merchant isolation.

Before exposing merchant-scoped Pay endpoints, the backend/database layer must provide and validate the intended policy or an equivalent non-browser data-access boundary.

## Gate B — Pay mutation routine hardening

The live security advisor reports mutable `search_path` on:

- `pay_reject_mutation`
- `pay_reject_merchant_ledger_mutation`
- `pay_insert_merchant_principal_entry`
- `pay_skip_duplicate_payment_transfer`

These routines must be hardened before they are reachable through any browser-accessible path.

## Gate C — production HTTP contract

No production Pay HTTP service is currently advertised by the public API catalog on `main`. The frontend therefore must not implement concrete Pay endpoints by inference from SQL function names or table columns.

## Gate D — authoritative lifecycle

A production API contract must expose a server-authoritative Payment Intent/payment lifecycle. The frontend must consume that lifecycle and preserve distinctions between submission, detection, verification, confirmation, and completion.

## Gate E — financial representation

Atomic financial values must not be converted to floating-point UI business values in a way that can change their meaning. Any formatting layer must preserve the server-authoritative value and token decimals.

## Gate F — release evidence

Before Pay becomes externally usable, validation must cover at minimum:

- backend contract tests
- RLS / tenant-isolation tests
- authorization tests
- idempotency tests
- verification/reconciliation tests
- adversarial payment cases
- webhook security tests
- production build
- frontend integration tests
- E2E checkout lifecycle tests

The frontend can proceed in parallel on presentation, state handling, accessibility, routing, and transport boundaries, but must not bypass these gates.
