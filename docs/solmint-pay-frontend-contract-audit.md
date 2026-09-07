# SolMint Pay — Frontend ↔ Backend Contract Audit Baseline

Date: 2026-09-06
Repository: `azad2022/solsite`
Frontend branch: `feat/solmint-pay-frontend-foundation`

## Purpose

This document records the current evidence boundary between the Pay frontend and the real backend/database. It is deliberately **not** an HTTP API specification.

The frontend must consume a production-enabled backend contract when one exists. This baseline records only contracts that have been explicitly implemented and validated; it must not be used to infer undocumented endpoints or financial business rules.

## Evidence observed

### Frontend

- Pay has an independent `src/pay` boundary.
- Routing supports `/pay`, Pay sections, and `/pay/checkout/:intentId`.
- Locale support exists for `fa-IR`, `en-US`, `ar`, and `ru` with real RTL/LTR direction handling.
- A reusable Pay HTTP transport exists at `src/pay/http.ts`.
- The transport only permits same-origin `/api/...` paths.
- A reusable Pay data-state model exists for `idle`, `loading`, `ready`, `empty`, `error`, `unauthorized`, `forbidden`, `stale`, and `retryable`.
- The typed Payment Intent service validates the released response shape before the Checkout UI consumes it.

### Released Pay HTTP surface on the feature branch

The branch explicitly implements:

`GET /api/pay/v1/payment-intents/:id`

The endpoint is documented in `public/openapi.json`, advertised by the API catalogs, and routed through `public/_routes.json`. It uses a server-only Supabase credential and returns an explicit checkout-safe allowlist.

Merchant-scoped dashboard APIs, mutations, refunds, webhook configuration, and other Pay services remain intentionally unreleased until their backend contracts are independently proven.

## Database source of truth

The live Supabase project contains Pay domain tables including:

- `pay_merchants`
- `pay_merchant_members`
- `pay_merchant_wallets`
- `pay_payment_intents`
- `pay_payment_transactions`
- `pay_payment_transfers`
- `pay_payment_events`
- `pay_merchant_ledger`
- `pay_revenue_ledger`
- `pay_commissions`
- `pay_referrals`
- `pay_invoices`
- `pay_payment_links`
- `pay_api_keys`
- `pay_webhooks`
- `pay_webhook_deliveries`
- `pay_wallet_challenges`
- `pay_gas_accounts`
- `pay_gas_ledger`
- `pay_idempotency_keys`
- `pay_audit_logs`
- `pay_rate_limit_buckets`

The database therefore has a substantially richer Pay domain than the currently exposed HTTP surface.

## Payment Intent evidence

The authoritative database row contains, among other fields:

- `amount_atomic`
- `customer_total_atomic`
- `fee_atomic`
- `fee_bps`
- `fee_payer`
- `fee_recipient`
- `merchant_net_atomic`
- `merchant_settlement_atomic`
- `recipient`
- `reference`
- `asset`
- `network`
- `token_mint`
- `token_program`
- `token_decimals`
- `expires_at`
- `status`
- `verification_commitment`

These values remain server-authoritative. The frontend does not reconstruct financial truth from other observations.

## Verification evidence

`pay_payment_transactions` contains authoritative verification/on-chain observations such as:

- signature
- slot
- block time
- commitment
- success
- confirmed
- verification status
- authoritative flag
- observed amount
- reference match
- recipient
- token mint/program/decimals
- rejection reason

The frontend never treats a submitted signature, reference, or webhook delivery as payment success.

## Security evidence from live Supabase

The current live database has no RLS policies for the `pay_*` tables through `pg_policies`. Therefore merchant isolation for future authenticated browser-facing operations is **not yet proven**.

The four Pay routines previously flagged for mutable `search_path` were hardened on the live project and the same remediation is now persisted in the repository migration chain. Live verification confirms `search_path=public`, no `anon`/`authenticated` execution, and retained `service_role` execution.

The Supabase security advisor still reports unrelated pre-existing warnings on `pg_net` and several CMS/category helper functions. They are outside this Pay contract boundary and must not be mistaken for Pay-specific resolution.

## Frontend integration gates

Currently released:

1. Payment Intent public read snapshot

Currently blocked pending backend contracts and release evidence:

2. Merchant dashboard data service
3. Transaction list/detail service
4. Merchant management mutations
5. Wallet challenge service
6. Referral/accounting service
7. Invoice/payment-link service
8. Webhook configuration service
9. Refund/reversal service
10. Any UI success state driven by client observation rather than authoritative backend state

## Required contract release evidence

Every additional Pay service must provide before frontend integration:

- production endpoint and HTTP method
- authentication requirements
- authorization/merchant isolation behavior
- request schema
- response schema
- error envelope and stable error codes
- idempotency behavior where applicable
- request/correlation ID behavior
- caching/no-store semantics
- pagination/filter semantics where applicable
- authoritative status vocabulary
- lifecycle guarantees
- security/RLS validation
- production deployment evidence

## Current decision

The Payment Intent read contract is integrated at the frontend boundary. Pay remains unreleased for production use until RLS/tenant isolation, production deployment validation, complete lifecycle evidence, current CI, and a controlled non-production E2E checkout are green.
