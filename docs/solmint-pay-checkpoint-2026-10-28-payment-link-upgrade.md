# SolMint Pay — Payment Link Upgrade Stages 2–3 Checkpoint

Date: 2026-10-28

## Current status

**IMPLEMENTATION / PRE-MERGE VALIDATION PASS — PRODUCTION RELEASE BLOCKED UNTIL THE CONTROLLED MIGRATION IS APPLIED AND VERIFIED**

- Pull request: [#363 — Payment Link upgrade stages 2–3](https://github.com/azad2022/solsite/pull/363)
- Validated application/workflow SHA: `2d3b738c82dfc466e1acb20e26dd711555c09d5d`
- Feature branch: `feat/pay-payment-link-upgrade-stages-2-3`
- The PR remains a draft. No production migration was applied by this checkpoint.

## Implemented scope

- Merchant-configured HTTPS success redirect is copied from the Payment Link into the Payment Intent snapshot. Checkout redirects only when the fetched authoritative Payment Intent status is `completed`.
- Optional `max_payments` is enforced in the database Payment Intent creation routine while the Payment Link row is locked. The public remaining-count is presentation only; it is not the authority for accepting payments.
- Checkout fields are allowlisted (up to five fields with unique keys and validated type/label/required flag). Server and SQL validate values, and the submitted values are stored on the Payment Intent. They are not included in the public Payment Intent response.
- Merchant form, public Checkout form, shared service contracts, localized text, and contract/security regression coverage were added.
- The Production Build preview check was fixed to choose a successful Cloudflare Pages check with a parsed Preview URL instead of accidentally taking the first HTTPS link (which can be a Cloudflare dashboard log URL).

## Validation evidence for SHA `2d3b738c82dfc466e1acb20e26dd711555c09d5d`

| Gate | Result | Evidence |
|---|---|---|
| CI / typecheck / unit tests | **PASS** | [Run 40708386070](https://github.com/azad2022/solsite/actions/runs/40708386070) |
| Production Build and Preview route smoke | **PASS** | [Run 40708386142](https://github.com/azad2022/solsite/actions/runs/40708386142) |
| Payment Link DB security fixture | **PASS** | [Run 40708386124](https://github.com/azad2022/solsite/actions/runs/40708386124) |
| SolMint Pay Devnet E2E | **PASS** | [Run 40708386071](https://github.com/azad2022/solsite/actions/runs/40708386071) |
| SolMint Pay Mainnet read-only | **PASS** | [Run 40708386063](https://github.com/azad2022/solsite/actions/runs/40708386063) |
| Cloudflare Pages preview | **PASS** | [Check 122887070239](https://github.com/azad2022/solsite/runs/122887070239) |

The Supabase Preview check is **SKIPPED** because Supabase branching/preview DB is disabled for this project. The database upgrade is instead tested in the workflow's disposable PostgreSQL fixture; Production was queried read-only to verify the migration is still pending.

## Production database facts

Read-only inspection of Production shows:

- Latest applied migration version is `20261028064400` (`solmint_pay_webhook_payload_enrichment`).
- `public.pay_payment_links` does not yet contain `success_url`, `max_payments`, or `checkout_fields`.
- `public.pay_payment_intents` does not yet contain `payment_link_success_url`, `payment_link_checkout_fields`, or `customer_custom_fields`.
- The live Payment Link creation/update RPC signatures are still the pre-upgrade versions.
- `pay_payment_links` and `pay_payment_intents` have RLS enabled; `authenticated` has table SELECT but no direct INSERT on these tables. `pay_idempotency_keys` has RLS enabled and no direct SELECT/INSERT grant to `authenticated`.
- The existing Payment Intent table currently has its expiry guard as the only user-defined table trigger. The new migration's update behavior was tested in an isolated PostgreSQL fixture; live production DDL was not executed.

No production writes were performed by this checkpoint.

## Release decision and next gate

**Do not merge/deploy the application before the schema/RPC migration is applied.** The current application branch queries the new columns, so code-first deployment would make Payment Link reads and Payment Intent reads fail against the current Production schema.

Required order:
1. Approve and run the repository's controlled Production Migration workflow with the exact intended migration, after its dry-run and migration audit.
2. Verify live columns, overload signatures, grants/revokes, RLS isolation, and the recorded migration version using read-only checks.
3. Update `docs/solmint-pay-live-migration-ledger.txt` only after the live database records the migration and positive evidence exists.
4. Re-run release checks against the final branch head, make the PR ready, merge through the normal path, and verify the Cloudflare Pages production deployment plus post-deploy smoke.

The legacy `Workers Builds: solsite` integration is separate from the configured Cloudflare Pages release path; its final status should be recorded if it completes, but it must not be substituted for the Pages deployment result.

## Audit rules

- `submitted` is not `paid`; redirect relies only on backend status `completed`.
- Capacity enforcement is database-authoritative and serialized under a Link-row lock.
- No direct frontend Supabase/RPC calls or client-side secret exposure were introduced.
- This checkpoint is a **pre-merge** validation record, not a production release acceptance.
