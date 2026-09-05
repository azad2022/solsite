# SolMint Pay — Foundation and Release Plan

## Product boundary

SolMint Pay lives under `/pay` but is a separate product boundary from the existing content, tools, and wallet UI. The first public implementation will use the existing SolMint domain while keeping Pay-specific frontend modules, backend routes, data contracts, and styling isolated.

## Commercial policy (initial)

- Gateway fee: **1.00%** per successful payment (`100 bps`).
- Fee payer: merchant or customer; merchant chooses the default and may override it per payment link/invoice/API request.
- Network fee is distinct from the SolMint gateway fee.
- Gas sponsorship is opt-in and separately accounted for.
- Referral commissions are calculated from eligible gateway revenue, not sign-ups alone.
- Merchant funds remain outside SolMint custody in the non-custodial base model.

## Channels

The same payment engine must support:

- Hosted web checkout.
- Payment links.
- QR / Solana Pay compatible requests.
- Website integration through API/SDK.
- Application integration.
- Social-media sharing through payment links.

## Planned domain modules

```text
frontend: src/pay/
  app/             product bootstrapping and release gate
  components/      Pay-only design system
  features/
    merchant/      merchant account and settings
    payments/      payment intent and payment state UI
    checkout/      customer checkout experience
    invoices/      invoice lifecycle UI
    referrals/     affiliate and referral UI
    analytics/     merchant reporting UI
    developer/     API keys, webhooks, docs entry points
  i18n/             locale registry and translations
  layouts/          public, merchant, checkout and developer shells
  pages/            route-level screens
  services/         API/domain service boundary
  styles/           Pay-only design tokens
  types/            stable domain contracts

backend: functions/api/pay/
  merchants/        merchant-facing operations
  payments/         payment intent/payment operations
  checkout/         public checkout operations
  invoices/         invoice operations
  refunds/          refund operations
  webhooks/         webhook delivery and replay
  referrals/        attribution and commission operations
  wallets/          merchant receiving / gas policy operations
  shared/           validation, errors, auth and accounting helpers
```

## Multilingual requirement

Dashboard and customer-facing surfaces are independently locale-aware. Persian is the first complete locale. English, Arabic and Russian catalogs exist from the foundation stage so adding languages does not require rewriting feature components.

RTL/LTR is determined by locale and layouts must use logical CSS properties.

## Payment lifecycle

```text
CREATED → PENDING → DETECTED → VERIFYING → CONFIRMED → COMPLETED
```

Exceptional states include `EXPIRED`, `UNDERPAID`, `OVERPAID`, `WRONG_TOKEN`, `WRONG_RECIPIENT`, `DUPLICATE`, `FAILED`, and `REFUNDED`.

## Accounting boundaries

Keep these ledgers logically distinct:

1. Merchant payment principal.
2. SolMint gateway revenue.
3. Referral commission liability.
4. Gas sponsorship spend/credit.
5. Refund amounts.

A blockchain transaction must never be treated as the accounting record by itself; a payment record references one or more blockchain observations.

## Release gates

No public `/pay` route or production payment endpoint should be enabled until:

1. Database schema and RLS policy are reviewed.
2. Payment verification is implemented and tested.
3. Idempotency is enforced for payment creation and event processing.
4. Webhook signing, retry, replay and delivery history are implemented.
5. Fee and referral accounting is deterministic and auditable.
6. Gas sponsorship limits and emergency disable paths exist.
7. Sandbox/testnet flows and production separation exist.
8. API v1 is documented.
9. Pay-specific UI is accessibility and responsive tested.
10. SEO metadata and public information architecture are reviewed.
11. Observability, alerting and rollback are ready.
12. Final production deployment and domain configuration are explicitly approved.
