# SolMint Pay — Frontend ↔ Backend Contract Audit Baseline

Date: 2026-09-06
Repository: `azad2022/solsite`
Frontend branch: `feat/solmint-pay-frontend-foundation`

## Purpose

This document records the current evidence boundary between the Pay frontend and the real backend/database. It is deliberately **not** an HTTP API specification.

The frontend must consume a production-enabled backend contract when one exists. Until then, this document prevents accidental invention of endpoints, response fields, or financial business rules.

## Evidence observed

### Frontend

- Pay has an independent `src/pay` boundary.
- Routing supports `/pay`, Pay sections, and `/pay/checkout/:intentId`.
- Locale support exists for `fa-IR`, `en-US`, `ar`, and `ru`.
- A reusable Pay HTTP transport exists at `src/pay/http.ts`.
- The transport only permits same-origin `/api/...` paths and does not define Pay business endpoints.
- A reusable Pay data-state model exists for `idle`, `loading`, `ready`, `empty`, `error`, `unauthorized`, `forbidden`, `stale`, and `retryable`.

### Public HTTP surface on `main`

The repository currently exposes public content APIs under `/api/v1/*`. The public API catalog currently advertises articles, Solana status, token tools, market context, and wallet analysis. No production Pay HTTP service is advertised there.

Therefore the Pay frontend must not add a real `/api/pay/*` service client until the backend contract is explicitly production-enabled.

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

These values must remain server-authoritative. The frontend must not reconstruct or recalculate them as business truth.

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

The frontend must never infer `paid`, `confirmed`, `finalized`, or `verified` from a submitted signature alone.

## Security evidence from live Supabase

The current live database reported no RLS policies for the `pay_*` tables through `pg_policies`. RLS status therefore cannot be treated as equivalent to a verified merchant-isolation policy set.

The live security advisor also reports mutable `search_path` configuration on these Pay routines:

- `pay_reject_mutation`
- `pay_reject_merchant_ledger_mutation`
- `pay_insert_merchant_principal_entry`
- `pay_skip_duplicate_payment_transfer`

These are backend/security findings and must be remediated in the correct database/backend layer before sensitive Pay HTTP operations are exposed.

## Frontend integration gates

The following are intentionally blocked until the backend contract is production-ready:

1. Payment Intent fetch service
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

Before a Pay service is added to the frontend, the backend must provide:

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

Once these are available, `src/pay/http.ts` can receive concrete service methods without changing the transport boundary.
