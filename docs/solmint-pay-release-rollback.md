# SolMint Pay — Production Recovery / Redeploy Runbook

## Scope

This runbook covers the existing SolMint production deployment architecture:

- Cloudflare Pages with Pages Functions for the deployed web/API boundary.
- Production branch: `main`.
- Production origin: `https://solmint.ir`.
- Supabase Production remains the authoritative database and migration state.
- The separate Node/Express runtime is not the production Pay deployment target.

This runbook is intentionally source-controlled and requires no manual Cloudflare dashboard action, Cloudflare API token, Account ID entry, GitHub Ruleset configuration, or other operator-created provider secret.

## Release provenance

A production release is a validated Git commit on `main` that has passed the applicable repository checks and has been deployed by the existing Cloudflare Pages integration.

Record, through repository/CI evidence where available:

1. release commit;
2. deployment/build evidence;
3. post-deployment production smoke evidence;
4. relevant application/runtime regression evidence.

## Normal deployment path

The normal path is:

`validated change → main → existing Cloudflare Pages deployment integration → production smoke`

No separate deployment platform or provider-management API is required.

## Recovery strategy

Recovery uses the same source-controlled deployment path rather than a provider-management rollback API.

1. Identify the last known-good application commit from Git history and CI/deployment evidence.
2. Revert the faulty application change, or restore the known-good commit through the repository's normal change workflow.
3. Allow the existing Cloudflare Pages integration to deploy the resulting `main` state.
4. Run the existing non-mutating production checks against `https://solmint.ir`.
5. Record the recovery commit and smoke evidence in `docs/solmint-pay-progress.md`.

For a multi-commit incident, prefer a minimal corrective commit or an explicit revert that preserves migration compatibility. Do not rewrite authoritative payment, reconciliation, ledger, or verification history.

## Database compatibility rule

A source rollback/redeploy changes the application deployment, not the Supabase migration history.

Therefore:

- Do not run destructive SQL or reverse migrations merely to restore an older application build.
- Before restoring older application code, verify compatibility with the live migration state.
- If an older application build is not compatible with the current schema, create a forward-compatible repair instead of forcing a database rollback.
- Preserve authoritative payment, reconciliation, ledger, and blockchain verification data.

## Post-recovery verification

After the recovered application is deployed, run the existing checks that apply to the changed surface, including:

1. SolMint Pay Production API Smoke.
2. SolMint Pay Live Smoke.
3. Authentication/session checks applicable to the Pay boundary.
4. Mainnet read-only checks where applicable.
5. Feature-specific regression/E2E checks.

For payment-related incidents, verify that frontend state remains backend-authoritative and that submitted signatures, references, browser state, or webhook delivery are never treated as payment success.

For Merchant/Wallet incidents, verify authenticated server mediation and merchant tenant isolation.

## Recovery completion criteria

Recovery is complete only when:

- the recovered commit is deployed;
- production health/smoke checks pass;
- affected authentication/authorization checks pass;
- application/schema compatibility is confirmed;
- no new critical database/security error is observed;
- recovery commit and validation evidence are recorded.

## What is deliberately not a Release Gate

The following are outside the SolMint Pay release workflow and must not be assigned as mandatory manual steps to the project owner:

- GitHub Ruleset / Branch Protection setup;
- Cloudflare dashboard configuration for rollback;
- Cloudflare API Token creation;
- Cloudflare Account ID entry;
- provider-management secrets created only to validate rollback;
- a dedicated Cloudflare API rollback test.

These may be useful operational controls in an environment that supports them, but they are not required to deploy or recover this repository through its existing source-controlled path.

## Release safety invariant

Removing these manual prerequisites does not permit bypassing engineering gates. CI, build, backend contracts, database/RLS, authentication/authorization, payment verification, reconciliation, accounting, security, E2E evidence, deployment evidence, and production smoke checks remain authoritative where applicable.

No production-ready claim may be made without positive evidence for the critical technical and runtime gates.
