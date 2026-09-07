# SolMint Pay — Production Release Audit Skill

This is the project release-audit workflow. Repository, backend contracts, live database/RLS state, migrations, security evidence, and deployment evidence outrank this document.

## Release gate sequence
1. Repository/HEAD and change scope.
2. Backend/API contracts and server mediation.
3. Database schema, migration history, grants, and RLS.
4. Authentication and authorization, including merchant tenant isolation.
5. Payment verification, reconciliation, accounting, webhook, idempotency, and rate limiting.
6. Secrets/runtime configuration without exposing secret values.
7. Unit, component, integration, E2E, security, and CI evidence.
8. Production build and deployment evidence.
9. Runtime smoke checks and rollback readiness.

## Security invariants
- No invented API, field, state, role, RPC, or business rule.
- No payment-success inference from submitted signatures, references, webhooks, or browser state.
- No direct sensitive Supabase/RPC access from browser code.
- No secrets, private keys, seed phrases, webhook secrets, API secrets, or internal JWT signing material in client bundles, URLs, logs, or telemetry.
- Merchant isolation must be enforced server-side and by database/RLS.
- API keys, webhook secrets, audit logs, idempotency state, and financial ledgers remain server-controlled.
- Financial truth comes from authoritative backend/database/blockchain verification paths.

## Database and RLS
Verify the live migration history, exact grants/revocations, authenticated access scope, `pay_request_user_id()` identity bridge, merchant access policy, affiliate ownership policy, and protection of sensitive Pay tables. Test cross-tenant reads and denied writes with adversarial fixtures. Never weaken production RLS to satisfy a UI or test.

## Authentication
Verify Better Auth routing, secure cookie behavior, trusted origins, Google OAuth callback configuration, email verification policy, rate limiting, application-user identity mapping, and fail-closed handling. Treat runtime secrets as configured/unknown based on deployment evidence; never request or print their values.

## Pay verification
Verify that Checkout and dashboard states reflect backend-authoritative payment intent and verification state. Distinguish submitted, detected, verifying, confirming, completed, underpaid, overpaid, wrong token, wrong destination, duplicate, ambiguous, failed, expired, and refunded states only where the actual contract exposes them.

## CI/CD
Every production change must leave the required CI/build/security workflows green. Avoid self-mutating production workflows and unnecessary `contents: write` permissions. Workflow failures must be repaired at source; do not suppress or bypass gates merely to obtain a green check.

## Production decision
`PASS` requires positive evidence for all applicable gates. `BLOCKED` applies to any unresolved security, contract, database/RLS, test, deployment, or runtime-critical issue. `UNKNOWN` applies where evidence could not be obtained. Do not label the system production-ready when critical runtime evidence is unavailable.
