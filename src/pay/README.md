# SolMint Pay

This directory is the dedicated frontend boundary for SolMint Pay.

## Purpose

SolMint Pay is a merchant-facing payment product exposed at `/pay` while remaining intentionally separate from the existing SolMint content, tools, and wallet UI.

The first implementation phase establishes structure and contracts only. The public route is intentionally not registered yet.

## Architectural rules

- Keep payment business logic out of the existing site components.
- Keep Customer Checkout, Merchant Dashboard, and Developer Portal as separate UI surfaces.
- Keep all display text behind the i18n layer; do not hard-code customer-facing copy in feature logic.
- Use semantic payment states and typed domain models instead of presentation strings.
- Keep blockchain verification behind a service boundary so the UI does not call RPC/indexers directly.
- Keep referral accounting separate from payment presentation and calculate commissions from eligible gateway revenue.
- Treat fee payer selection (`merchant` or `customer`) as a first-class payment policy.
- Keep Gas Sponsorship as a separate policy and accounting boundary.

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

## Launch gate

`/pay` must not become publicly reachable until the following are complete and reviewed:

1. Payment lifecycle and verification design.
2. Supabase schema and accounting model.
3. API v1 contract.
4. Webhook reliability model.
5. Referral and fee economics.
6. Gas sponsorship policy.
7. Checkout and merchant UX.
8. SEO metadata and public information architecture.
9. Production tests and observability.
10. Deployment and rollback plan.
