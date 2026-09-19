# SolMint Pay — Production Rollback / Recovery Runbook

## Scope

This runbook covers the existing Solmint production deployment architecture:

- Cloudflare Pages with Pages Functions for the deployed web/API boundary.
- Production branch: `main`.
- Production origin: `https://solmint.ir`.
- Supabase Production remains the authoritative database and migration state.
- The separate Node/Express runtime is not the production Pay deployment target.

This document is an operational recovery procedure. It does not authorize a database rollback or invent a second deployment platform.

## Release provenance

A production release is a Git commit on `main` that has passed the repository release gates and has been deployed successfully by Cloudflare Pages.

Before any rollback decision, record:

1. current production commit/deployment identifier;
2. current known-good production commit/deployment identifier;
3. the first failing or suspect release identifier;
4. the relevant GitHub checks and production smoke evidence.

A rollback target must be a previously successful **production** Pages deployment. Preview deployments are not valid Pages rollback targets.

## Cloudflare Pages rollback

Cloudflare's documented Pages rollback flow is:

1. Open the Cloudflare dashboard.
2. Open **Workers & Pages** and select the production Pages project.
3. Open **Deployments** and locate the known-good successful production deployment.
4. Open its actions menu.
5. Select **Rollback to this deployment**.
6. Confirm the rollback.

The production deployment changes immediately after confirmation.

Cloudflare also exposes an API rollback operation for Pages deployments. It requires a token with **Pages Write** permission and accepts only successful production builds as rollback targets.

Do not add a Cloudflare API token to the browser, repository, URL, logs, or telemetry. Any API-driven rollback must remain an operator-side secret-controlled action.

Official references:
- https://developers.cloudflare.com/pages/configuration/rollbacks/
- https://developers.cloudflare.com/api/go/resources/pages/subresources/projects/subresources/deployments/methods/rollback/

## Database compatibility rule

A Pages rollback changes the application deployment, not the Supabase migration history.

Therefore:

- Do **not** run destructive SQL or reverse migrations merely to restore an older application build.
- Before selecting an older deployment, confirm that its code is compatible with the migration state currently recorded in Production.
- If the suspected incident is caused by a forward database migration that the older application cannot tolerate, do not perform an application-only rollback and declare recovery complete. Use a forward-compatible repair/release.
- Preserve all authoritative payment, reconciliation, ledger, and verification data.

This project treats the live Supabase migration ledger as authoritative and intentionally does not rely on destructive Production migration rollback.

## Post-rollback verification

After Cloudflare confirms the rollback, run the existing non-mutating production checks against `https://solmint.ir`:

1. SolMint Pay Production API Smoke.
2. SolMint Pay Live Smoke.
3. Authentication/session verification applicable to the Pay boundary.
4. Mainnet read-only checks applicable to the affected deployment.
5. Any feature-specific regression check associated with the incident.

For a payment-related incident, verify that the frontend still reads Payment Intent state from the backend and does not infer success from browser submission, signatures, references, or webhook delivery.

For Merchant/Wallet incidents, verify that the Merchant and Wallet Ownership contracts remain authenticated and tenant-isolated.

## Recovery completion criteria

Recovery is **not complete** merely because the previous deployment is visible in Cloudflare.

A rollback can be recorded as successfully validated only when:

- the selected production deployment is confirmed active;
- the deployment is compatible with the current live Supabase migration state;
- post-rollback Pay API Smoke passes;
- non-mutating Live Smoke passes;
- affected authentication/authorization checks pass;
- no new critical database/security error is observed;
- the recovered deployment identifier and validation run identifiers are recorded in `docs/solmint-pay-progress.md`.

## Controlled rollback evidence

Issue #120 remains open until an operator performs a controlled rollback/recovery validation on the actual production Pages project and records the evidence.

Minimum evidence to capture:

- previous production deployment identifier;
- rollback target deployment identifier;
- timestamp;
- confirmation that the target was a successful production deployment;
- post-rollback Production API Smoke result;
- post-rollback Live Smoke result;
- confirmation that no destructive Supabase migration rollback was performed;
- final decision to restore the newest release or retain the rollback.

## Normal release recovery sequence

`Incident → identify last known-good production deployment → verify DB/app compatibility → rollback Pages → run smoke checks → record evidence → either restore newest release or keep recovered version`

This procedure must remain separate from Pay financial truth. No recovery action may rewrite authoritative payment status, merchant balances, reconciliation state, ledger history, or blockchain verification records from the frontend.
