# SolMint Pay — Backend Exposure Gates

These gates are based on the repository state and live Supabase project `nvopkbiedorfshwbmyhn` validated on 2026-09-10.

## Gate A — RLS / tenant isolation — PASS (adversarial validation)

All 23 live `pay_*` tables are RLS-enabled. Merchant-scoped authenticated tables expose SELECT only through tenant-aware policies, while sensitive server-only tables have no authenticated SELECT grant.

Production adversarial validation used ephemeral transaction-scoped fixtures and verified:

- merchant A is isolated from merchant B
- payment intents remain tenant-isolated
- owner access works only for the owned merchant
- unauthorized role elevation is denied
- suspended/inactive/unknown identities do not gain merchant access
- authenticated has no direct INSERT/UPDATE access to payment intents
- authenticated cannot read sensitive API-key/webhook data

All fixtures were rolled back; production data was left unchanged.

## Gate B — Pay mutation routine hardening — PASS

The four Pay routines previously flagged for mutable `search_path` remain hardened in the repository migration chain:

- `pay_reject_mutation`
- `pay_reject_merchant_ledger_mutation`
- `pay_insert_merchant_principal_entry`
- `pay_skip_duplicate_payment_transfer`

The intended execution boundary remains server-side/service-role only.

## Gate C — production HTTP contract — PASS for unauthenticated/security boundary; authenticated merchant path pending

A production contract smoke is now executed against `https://solmint.ir` and verifies:

- malformed Payment Intent IDs return the canonical JSON error envelope
- merchant reads require a valid SolMint session
- forged bearer credentials do not create an authenticated Pay principal
- merchant creation rejects untrusted origins
- merchant creation requires authentication before mutation
- wallet-challenge issuance requires authentication before mutation
- Payment Intent creation requires a merchant API credential

The authenticated merchant creation → wallet ownership → API credential path is intentionally not claimed yet because production currently has no merchant/API-key fixture suitable for a full authenticated E2E.

## Gate D — authoritative lifecycle — PARTIALLY RELEASED

The Payment Intent contract exposes server-owned payment state and verification data. The Checkout frontend must consume these values without inferring success from transaction submission, reference, signature, or webhook delivery.

The full lifecycle gate remains open until controlled real observations prove detection, verification, confirmation, completion, and failure/replay behavior.

## Gate E — financial representation — PASSING AT CONTRACT/UI BOUNDARY

Atomic financial values are transported as strings. Frontend presentation must not use floating-point arithmetic for authoritative financial calculations and must not calculate balances, settlement, revenue, withdrawal eligibility, refunds, or payment success.

## Gate F — release evidence — IN PROGRESS / BLOCKED FOR EXTERNAL USE

Completed evidence:

- immutable CI typecheck/build/tests
- production build validation
- production API security/contract smoke
- production RLS tenant-isolation adversarial validation
- Mainnet read-only provider compatibility
- webhook egress security validation
- Pay database routine/RLS security checks

Remaining evidence:

- authenticated production Merchant onboarding contract with a controlled account
- wallet ownership verification lifecycle
- API credential issuance/revocation and payment-intent authorization E2E
- controlled non-production funded Payment Intent lifecycle E2E
- adversarial payment cases including underpayment, overpayment, wrong asset/recipient/reference, duplicate/replay, expiry and ambiguous discovery
- final release audit and branch-protection enforcement

The live Pay database currently contains no Merchant/API-key production fixture. No mock production payment is inserted merely to create green E2E output.

## Current decision

Pay has a validated authorization/RLS foundation and a live unauthenticated/security contract. The frontend may continue integration against the published backend contracts, but external production Pay remains unreleased until the authenticated merchant path, controlled payment lifecycle, adversarial verification evidence, and final release gates are complete.
