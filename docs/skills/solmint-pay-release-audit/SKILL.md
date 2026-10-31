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
Every production change must leave the applicable CI/build/security workflows green. Avoid self-mutating production workflows and unnecessary `contents: write` permissions. Workflow failures must be repaired at source; do not suppress or bypass gates merely to obtain a green check.

## Deployment and recovery
The normal release path is source-controlled: validated commit → main → the existing Cloudflare Pages deployment integration → production smoke checks.

Release is not gated on manual GitHub Ruleset/Branch Protection configuration, Cloudflare dashboard changes, Cloudflare API credentials, or provider-management secrets created by an operator. A provider-level control that cannot be verified by the repository's available automation is recorded as outside this release workflow rather than assigned as a manual prerequisite to the project owner.

Production recovery uses the source-controlled redeploy path: identify the last known-good commit, restore/revert the application source as appropriate, allow the normal Pages deployment to run, and re-run post-deployment smoke checks. Cloudflare API rollback validation is not a release gate.

## Production decision
`PASS` requires positive evidence for all applicable repository/backend/database/security/test/deployment/runtime gates. `BLOCKED` applies to unresolved security, contract, database/RLS, test, deployment, or runtime-critical issues. `UNKNOWN` applies where evidence cannot be obtained. External provider governance controls that are not required for the actual deployment path do not block release. Never label the system production-ready when critical runtime evidence is unavailable.

## Subscription Billing release gates
For every Subscription Billing audit or release, read docs/skills/solmint-pay-subscriptions/SKILL.md and revalidate its facts against the exact Program release, IDL, SDK, current repository, live schema and cluster. Do not assume a roadmap, Skill, SDK tag, upstream main, or vendor deployment announcement proves the deployed Mainnet binary.

Verify the actual Program ID/cluster/ProgramData and deployed binary/source/IDL/SDK compatibility. Review the complete external audit report and commit-level delta from the audited baseline and remediation commit; do not call later source or deployment "audited" without evidence. Treat the v0.5.0 vs deployed 0.5.0-beta.1 label difference as a version-verification item.

Review the customer's signed consent and the broad u64::MAX Token Delegate approval, Plan/Subscription limits, explicit destination allowlist, implicit Plan Owner pull authority, Puller membership, Token Account/Mint/Program, fixed-hours period, cancellation/resume/revoke lifecycle and stale-approval protections.

Collector signing is a separate security boundary: verify isolated key custody, narrow Puller permissions, exact decoded instruction/account allowlist, per-cycle policy, simulation, anti-replay, idempotency, rate limiting, signer audit, rotation and compromise recovery. Cloudflare runtime secrets are not an HSM. Public endpoints must never sign arbitrary customer-supplied transaction bytes.

Critical compatibility gate: the inspected normal Pay reconciliation requires merchant/fee transfer source authority to equal transaction fee payer and rejects gas-sponsored observations. Subscription Authority PDA and Collector fee payer are different principals. Do not weaken the current verifier or bypass fee/accounting checks. Require a dedicated Subscription verification/database adapter, exact on-chain evidence and atomic ledger handling before enabling charges.

Billing retry must distinguish rejected, retryable, submitted-unknown and verified outcomes. On RPC timeout or process restart, reconcile the existing transaction before another debit. Verify database-enforced unique cycle/attempt identity, atomic claims, cross-merchant/customer RLS, grants/revokes, append-only accounting, webhook outbox, Devnet E2E and adversarial tests. Webhook delivery is notification, never financial proof.


## Additional Subscription release blockers — 2026-10-30

- Treat the upstream v0.5.0 README Security Considerations as first-class threat-model input. A held init+subscribe bundle using `UNKNOWN_INIT_ID` can recreate authority and a spendable subscription after revoke. Production v1 must use separate init and Subscribe transactions and the actual observed `init_id`; reject the sentinel.
- Do not accept Durable Nonce or unresolved smart-wallet/multisig proposals for consent/control in v1. A recent blockhash expiry is not the same as canceling a pending program-controlled wallet proposal. Reconcile every outstanding approval/nonce/proposal before telling a customer an authority or consent is revoked.
- Test the same-period Resume replay edge, second-granular immediate-cancel replay, UpdatePlan ABA, held authority init/close/revoke, shared authority scope, and finite Plan near-expiry full-period charge. Do not describe slot-scoped `init_id` as a global generation or permanent revocation mechanism.
- The Plan Owner is implicitly authorized to pull and cannot be removed. Reconcile every authorized Puller, not only Collector-generated transactions. Concurrent Plan Owner pulls can consume the same on-chain period allowance before a Collector transaction lands.
- Subscription period identity comes from live on-chain SubscriptionDelegation period-start/usage state. Do not derive it from calendar months or scheduler timestamps. A scheduler is a trigger; a database unique cycle key and atomic claim/attempt are still required.
- A `TransferSubscription` instruction has one destination/amount. Any principal+fee split needs two explicitly allowed destinations and proof, using the pinned Program, that multiple instructions in one transaction enforce one cumulative period allowance and rollback atomically. Until LiteSVM adversarial tests, Devnet E2E, dedicated verifier and accounting approval pass, split-fee subscription charge is BLOCKED.
- The Program allowlist checks destination token-account owner; an empty list permits any destination. Require a non-empty explicit Plan allowlist and validate mint/program/ATA/owner.
- An active on-chain Subscription is not proof of collectability or service entitlement. Check delegate, actual ATA/mint/frozen/balance state as applicable; unlock service only after independent finalized transfer verification and atomic ledger commit.
- One SPL Token account has one approved delegate slot; replacing an existing delegate needs explicit customer disclosure/consent. Revoke of the shared customer+mint authority affects other subscriptions.
- **PASS (evidence identity/review only):** the complete 12-page Cantina PDF and eight-commit post-remediation release delta were reviewed on 2026-10-31; the delta contains no program/src/** changes. Finalized read-only Mainnet ProgramData confirms the deployed ELF hash equals the reproducible pinned-source build hash, and the canonical on-chain Program Metadata/IDL hash equals the pinned source IDL hash. The ProgramData upgrade authority resolves to the inspected Squads v4 Vault/State pair (3-of-5, zero-second timelock). The five Cantina Acknowledged findings remain residual risks; Squads member identity/custody remains UNKNOWN. These PASS results do not close Stage 2 or authorize Production Subscription.
- No Production DDL while issue #355 migration-runner provenance is open. No Production signer, live consent, Mainnet transfer or migration without explicit authorization and documented recovery.
 
## 2026-10-31 Subscription v1 threat-model release gate

Use `docs/solmint-pay-subscription-v1-threat-model.md` as the finding-to-control/test matrix for any Subscription release audit. It is design-only, not evidence of implementation. A build, SDK compatibility test, ProgramData hash match, IDL hash match or UI restriction cannot close an upstream replay vulnerability.

The Cantina PDF contains an unresolved summary/detail count discrepancy: summary table = five Acknowledged total (three Medium); detailed pages = six Acknowledged (one High, four Medium, one Low) and three Fixed. Until written clarification is obtained, track the six detailed Acknowledged findings conservatively. The old-signed-create finding remains BLOCKED for strong revocation unless protocol-enforced persistent epoch/nonce/deadline state and legacy-instruction rejection are evidenced. Do not treat off-chain builder policy as a protocol fix.
