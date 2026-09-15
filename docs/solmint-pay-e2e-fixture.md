# SolMint Pay — Controlled E2E Fixture

This document records the durable controlled production fixture used by the authenticated Pay E2E workflow. It exists so future test runs reuse the same fixture instead of recreating test users and merchants.

## GitHub Actions Secrets

The corresponding secret **names** are stored in GitHub Actions repository secrets. Secret values must never be committed here.

- `PAY_E2E_EMAIL`
- `PAY_E2E_PASSWORD`
- `PAY_E2E_MERCHANT_ID`
- `PAY_E2E_OTHER_MERCHANT_ID`

Do not add passwords, API-key plaintext, private keys, or other credential values to this file, issues, commits, logs, or URLs.

## Controlled fixture identity

Primary E2E user:

- Application/Better Auth user ID: `e2e_zQCvXDo5u7SqGeaF8f5rogN`
- Email: `pay-e2e-20260914@solmint.ir`
- Controlled merchant ID: `2acf4726-34b8-43ef-a1c8-e55f400af8d1`
- Merchant role: `owner`
- Merchant status: `active`

Isolation/IDOR target:

- Separate application/Better Auth user ID: `e2e_other_ao3s9bnAXxexBwymbCPf`
- Controlled other-merchant ID: `a2457aec-965e-471e-98a9-9460b18d65f1`
- Primary E2E user must not be authorized for this merchant.

## Purpose

This fixture is intentionally persistent and is the canonical controlled account/merchant pair for authenticated Pay API-key lifecycle E2E coverage, including:

- authentication and session establishment
- merchant authorization and isolation
- API-key create/list/replay/concurrency
- wrong-scope rejection
- cross-merchant IDOR rejection
- rotation and rotation replay
- old-key rejection after rotation
- revoke and post-revoke rejection
- expiry and post-expiry rejection
- plaintext-secret handling

The fixture is test-only and must not be used for real customer, merchant, or financial activity.

## Reuse rule

Do **not** recreate this user or either merchant during later test runs unless the repository evidence shows the fixture has been intentionally retired or corrupted. Reuse the existing GitHub Actions secrets and IDs above.

The existence of this fixture does not make Pay production-ready by itself. It is test infrastructure only; release readiness still requires all applicable backend, security, E2E, audit, CI, and production gates.
