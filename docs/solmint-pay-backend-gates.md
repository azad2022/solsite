# SolMint Pay — Backend Exposure Gates

These gates are derived from the live Supabase project and repository state observed on 2026-09-06.

## Gate A — RLS / tenant isolation — BLOCKED

Live inspection of `pg_policies` returned no policies for the `pay_*` tables. RLS being enabled is therefore not sufficient evidence for browser-facing merchant isolation.

Before exposing merchant-scoped Pay endpoints, the backend/database layer must provide and validate the intended policy or an equivalent non-browser data-access boundary. The public Checkout Payment Intent endpoint is deliberately limited to a server-side, ID-based snapshot and must not become a substitute for merchant-scoped dashboard authorization.

## Gate B — Pay mutation routine hardening — PASS

The four Pay routines previously flagged for mutable `search_path` were hardened in the live database and the exact remediation is now persisted in the repository migration chain:

- `pay_reject_mutation`
- `pay_reject_merchant_ledger_mutation`
- `pay_insert_merchant_principal_entry`
- `pay_skip_duplicate_payment_transfer`

Live verification confirms `search_path=public`, `anon` execution is revoked, `authenticated` execution is revoked, and `service_role` retains execution. These routines are not `SECURITY DEFINER`; this gate is specifically about search-path hardening and PostgREST execution exposure.

## Gate C — production HTTP contract — PARTIALLY RELEASED

A first real Pay read contract now exists in the feature branch:

`GET /api/pay/v1/payment-intents/:id`

The contract is published in `public/openapi.json`, advertised by the dynamic and static API catalogs, and routed through `public/_routes.json`. The response is an explicit checkout-safe allowlist; internal accounting fields are not exposed.

This gate remains operationally blocked until deployment validation proves that the endpoint is actually reachable in the target environment with the intended server-only Supabase credential configuration.

## Gate D — authoritative lifecycle — PARTIALLY RELEASED

The Payment Intent contract exposes the server-owned `status` and `verificationCommitment`. The Checkout frontend consumes these values verbatim and does not infer success from transaction submission, reference, signature, or webhook delivery.

The full lifecycle gate remains open until the release evidence proves authoritative detection, verification, confirmation, and completion behavior against real payment observations.

## Gate E — financial representation — PASSING AT CONTRACT/UI BOUNDARY

Atomic financial values are transported as strings. The frontend performs only decimal-point presentation using integer/string operations; it does not calculate fees, balances, settlement, revenue, eligibility, or payment success.

## Gate F — release evidence — BLOCKED

The following are still mandatory before Pay becomes externally usable:

- CI and production build on the current HEAD
- RLS / tenant-isolation validation
- authorization validation for merchant-scoped operations
- idempotency validation
- verification/reconciliation validation
- adversarial payment cases
- webhook security validation
- frontend integration validation
- a real E2E checkout lifecycle using a controlled non-production Payment Intent fixture

The live Pay database currently contains zero Payment Intent rows. Therefore a successful live checkout E2E cannot honestly be claimed from the current environment without introducing a controlled test fixture in an appropriate non-production environment.

## Current decision

The frontend may consume the released read contract, but `/pay` must remain an unreleased feature until Gates A, C operational verification, D, and F are green. No mock Payment Intent should be inserted into the production database merely to make E2E appear successful.
