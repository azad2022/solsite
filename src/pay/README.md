# SolMint Pay

This directory is the dedicated frontend boundary for SolMint Pay.

## Authoritative specification

The complete product and engineering source of truth is:

`docs/solmint-pay-v1-product-contract.md`

Read that document before changing Pay behavior. It defines the V1 product boundary, commercial model, accounting separation, referral economics, merchant/affiliate withdrawal rules, backend contracts, blockchain verification, reconciliation, security, frontend surfaces, light-theme UI direction, i18n, testing and release gates. The older `docs/solmint-pay-project-spec.md` document is background context only; if the documents conflict, the V1 product contract is authoritative.

Documentation is a contract, not implementation evidence. When code and the specification disagree, do not guess: identify the conflict and resolve the policy/architecture decision explicitly.

## Purpose

SolMint Pay is a separate merchant-facing payment product exposed at `/pay` while remaining intentionally separate from the existing SolMint content, tools, and wallet UI.

The public route is intentionally disabled until the project release gates pass.

## Architectural rules

- Keep payment business logic out of the existing site components.
- Keep Customer Checkout, Merchant Dashboard, Affiliate Dashboard, and Developer Portal as separate UI surfaces.
- Keep all display text behind the i18n layer; do not hard-code customer-facing copy in feature logic.
- Use semantic payment states and typed domain models instead of presentation strings.
- Keep blockchain verification behind a service boundary so the UI does not call RPC/indexers directly.
- Keep referral accounting separate from payment presentation and calculate commissions from eligible gateway revenue.
- Treat fee policy as a first-class payment policy and snapshot it into the Payment Intent.
- Keep Gas Sponsorship as a separate policy and accounting boundary.
- Do not trust frontend merchant IDs, referral counts, balances, payment status, or transaction-submission success.
- Use light/bright UI as the default Pay product direction.

## Product surfaces

```text
Customer Checkout
Merchant Dashboard
Affiliate / Referral Dashboard
Developer Portal
Public Pricing / Documentation
Security / FAQ / Status information
```

## Planned structure

```text
src/pay/
├── app/            Application bootstrap and feature flags
├── assets/         SolMint Pay-only SVGs and imagery
├── components/     Shared Pay design-system components
├── features/       Merchant, payments, checkout, invoices, referrals, webhooks, analytics, developer
├── i18n/           Locale registry and translation catalogs
├── layouts/        Public, merchant, checkout and developer layouts
├── pages/          Route-level Pay pages
├── services/       API/domain service boundaries
├── styles/         Pay-only theme tokens and global styles
├── types/          Stable domain contracts
└── utils/          Pure helpers with no network side effects
```

## Multilingual requirement

Pay must be multilingual-ready from the first release:

- `fa-IR` — first-class product locale
- `en-US` — first-class architecture/production target
- `ar` — RTL target
- `ru` — LTR target

RTL/LTR must use logical layout properties. Localized numbers, dates, errors, statuses and financial amounts must remain semantically consistent across locales.

## Financial boundary

The frontend must display, but never authoritatively determine:

- merchant principal
- gateway revenue
- referral liability
- gas cost
- refund state
- available/pending balances
- payout/withdrawal state

All of these come from authenticated server-side and database-enforced state.

## Launch gate

`/pay` must not become publicly reachable until the complete release checklist in `docs/solmint-pay-v1-product-contract.md` is satisfied on the same current release candidate/HEAD, including:

1. Payment lifecycle and blockchain verification.
2. Supabase schema, RLS, accounting and migration validation.
3. API v1 contract and abuse controls.
4. Webhook reliability and replay protection.
5. Fee and referral economics, attribution, liabilities and withdrawals.
6. Merchant settlement/withdrawal flow.
7. Gas sponsorship policy and signer boundaries, if enabled.
8. Checkout, merchant, affiliate and developer UX.
9. Light-theme responsive and accessibility validation.
10. Multilingual/i18n validation.
11. Production tests, real Devnet E2E and observability.
12. Deployment, rollback and final independent adversarial audit.
