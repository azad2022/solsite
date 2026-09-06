# SolMint Pay — Release Audit & Production Gate Skill

## Purpose

This is a companion project-specific engineering skill for auditing and releasing SolMint Pay. It is designed to be used with the SolMint Pay Build Web Apps Engineering Skill and the Pay Frontend Master Specification.

It does not replace the repository, backend contracts, database schema, RLS policies, migrations, production evidence, or release decisions. Those remain authoritative.

Repository: `azad2022/solsite`
Supabase project: `nvopkbiedorfshwbmyhn`
Hosting architecture: Cloudflare Pages/Functions + Supabase

## 1. Absolute release principles

1. Never call a feature production-ready because its UI exists.
2. Never call a backend capability production-ready because its tables exist.
3. Never call a merchant-scoped API safe until authentication, authorization, RLS, grants, tenant isolation, adversarial tests, and runtime behavior are verified.
4. Never call a payment successful from wallet submission, signature existence, reference match, webhook delivery, or an arbitrary RPC response.
5. Never call a financial amount authoritative if it was calculated by the browser.
6. Never merge or activate `/pay` while a required security, database, reconciliation, accounting, webhook, E2E, or release gate is incomplete.
7. Missing evidence is `UNKNOWN` or `BLOCKED`, never `PASS`.
8. Do not mutate Production merely to make a release gate green.

## 2. Current verified state must be re-checked before every release

At the time of this audit, the live Supabase schema contained the Pay domain tables and RLS was enabled on them, but the database inspection reported **zero RLS policies on the Pay tables**. This is a critical authorization blocker, not a frontend defect.

The following Pay tables were observed with RLS enabled and zero policies:

- `pay_merchants`
- `pay_merchant_members`
- `pay_merchant_wallets`
- `pay_wallet_challenges`
- `pay_payment_intents`
- `pay_payment_transactions`
- `pay_payment_transfers`
- `pay_payment_events`
- `pay_payment_links`
- `pay_invoices`
- `pay_referrals`
- `pay_affiliates`
- `pay_commissions`
- `pay_revenue_ledger`
- `pay_merchant_ledger`
- `pay_gas_accounts`
- `pay_gas_ledger`
- `pay_webhooks`
- `pay_webhook_deliveries`
- `pay_api_keys`
- `pay_idempotency_keys`
- `pay_rate_limit_buckets`
- `pay_audit_logs`

Do not interpret this list as a proposed policy design. The correct policies and grants must be derived from the actual authorization contract, reviewed migrations, internal identity bridge, and adversarial security tests.

The live security advisor also reported existing non-Pay `SECURITY DEFINER` functions callable by `anon`/`authenticated` and `pg_net` in `public`. These findings are separately triaged and must not be silently changed by Pay frontend work.

## 3. Source-of-truth hierarchy

Use this order when resolving conflicts:

1. Live Production behavior and captured Production evidence.
2. Approved Backend/API contract.
3. Approved database schema, constraints, functions, RLS policies and grants.
4. Approved migrations and migration runbooks.
5. Repository implementation and tests.
6. Project-specific Pay documentation.
7. Build Web Apps skills.
8. UI assumptions.

A lower layer must never override a higher authoritative layer.

## 4. Pre-implementation audit

Before changing any Pay UI, inspect:

- current Git branch and HEAD;
- open Pay PRs and their base/head relationship;
- changed files and review state;
- package scripts and dependency versions;
- routing and middleware;
- current Pay server files;
- authentication/session code;
- registration and login contracts;
- authorization helpers;
- current JWT bridge status;
- Supabase schema;
- RLS enabled state;
- actual RLS policies;
- role grants;
- SECURITY DEFINER/INVOKER functions relevant to Pay;
- Pay migration history;
- Production migration baseline/recovery status;
- Payment Intent and payment-engine implementation;
- verification/reconciliation implementation;
- accounting/ledger implementation;
- webhook worker and egress controls;
- API key and idempotency implementation;
- rate limiting;
- audit logging;
- E2E and security tests;
- CI and release evidence.

## 5. Registration and account lifecycle gate

Registration is not complete until the real contract is known and verified.

Audit:

- accepted fields;
- validation rules;
- duplicate-account behavior;
- rate limiting;
- disabled-account behavior;
- session creation;
- cookie attributes;
- logout/session invalidation;
- expiry behavior;
- password handling;
- enumeration resistance where required;
- audit/security events;
- frontend handling for validation, conflict, rate limit, unauthorized and server errors.

Never create a Pay-specific registration system merely because a Pay dashboard needs a login screen. Reuse the existing application authentication boundary unless the approved architecture explicitly changes it.

## 6. Merchant lifecycle gate

Merchant onboarding must define, using actual backend contracts:

- create merchant;
- owner assignment;
- initial status;
- business profile;
- slug uniqueness;
- supported checkout/dashboard locales;
- fee payer configuration;
- gateway fee configuration limits;
- suspension/closure behavior;
- owner/member lifecycle;
- recovery and support path.

The frontend must not expose controls for unsupported state transitions.

## 7. Merchant RBAC gate

Roles currently represented in the schema are:

- owner
- admin
- finance
- developer
- viewer

This is a domain fact, not permission proof.

Before exposing an operation, establish the real action matrix for:

- merchant settings;
- wallets;
- payment links;
- invoices;
- transactions;
- reports;
- API keys;
- webhooks;
- gas sponsorship;
- team membership;
- financial views;
- support;
- sensitive security actions.

Test every important operation with:

- correct merchant + correct role;
- correct merchant + wrong role;
- wrong merchant + correct role;
- unauthenticated caller;
- suspended member;
- removed member;
- suspended merchant;
- closed merchant.

URL identifiers are never authorization.

## 8. Customer checkout gate

Checkout must be driven by a backend-created Payment Intent.

The UI may display authoritative snapshots for:

- merchant;
- amount;
- asset;
- mint;
- token program;
- decimals;
- recipient;
- reference;
- fee policy;
- fee payer;
- gateway fee;
- customer total;
- merchant settlement;
- expiry;
- payment state;
- referral snapshot;
- gas policy.

The UI must distinguish:

`created -> pending/awaiting payment -> detected -> verifying -> confirming -> completed`

and exceptional states such as:

- expired;
- underpaid;
- overpaid;
- wrong token;
- wrong recipient;
- duplicate;
- ambiguous;
- failed;
- refunded.

A wallet signature is evidence that a transaction was submitted, not evidence that the payment succeeded.

## 9. Payment verification and reconciliation gate

For every payment, establish the authoritative relationship between:

- Payment Intent;
- observed blockchain transaction;
- transfer legs;
- reference correlation;
- recipient;
- asset/mint;
- token program;
- exact atomic amount;
- fee payer;
- commitment/finality;
- verification result;
- reconciliation result;
- accounting entries.

Test at minimum:

- valid payment;
- underpayment;
- overpayment;
- wrong token;
- wrong recipient;
- wrong reference;
- failed transaction;
- expired intent;
- duplicate observation;
- replay;
- ambiguous observation;
- RPC/provider failure;
- incomplete discovery;
- conflicting observations;
- already-completed payment.

No frontend implementation may simplify these cases into a generic failure/success state if doing so hides material financial meaning.

## 10. Financial/accounting gate

Keep these domains separate:

- customer payment amount;
- gateway fee;
- merchant principal/settlement;
- SolMint gateway revenue;
- referral liability;
- gas sponsorship economics;
- refund/reversal;
- reconciliation state.

Use exact numeric/atomic representations from the backend. Never use JavaScript floating point for authoritative accounting.

Never create a dashboard balance by summing arbitrary paginated rows unless the backend explicitly defines that calculation as a presentation-only aggregate and the result cannot be mistaken for authoritative accounting.

## 11. Referral economics gate

Referral attribution, eligibility, commission rate, commission amount, status and withdrawal eligibility are backend responsibilities.

The UI may display:

- referral code;
- referred merchants;
- policy/tier information;
- pending/approved/paid/void amounts;
- withdrawal threshold;
- available withdrawal;
- payout wallet state;
- withdrawal history;
- payout transaction evidence.

The UI must not promise a commission from registration alone. Commission liability is tied to eligible gateway revenue according to the current backend model.

Any future tier system must have an explicit backend contract before it is represented as operational functionality.

## 12. API key and webhook gate

API key UI must never expose stored key hashes or reusable secrets.

If the backend supports one-time secret reveal, show it only under that contract and make the security consequences explicit.

Webhook UI may expose endpoint, status, subscribed events, delivery health and retry information when authorized.

Never expose:

- plaintext webhook secrets;
- encrypted secret material;
- service-role credentials;
- internal signing keys.

Webhook delivery is notification infrastructure, not payment truth.

## 13. Operator/admin gate

The SolMint operator console is a separate trust boundary.

It may provide authorized operational visibility into:

- merchants;
- members;
- wallet verification;
- payment lifecycle;
- ambiguous/reconciliation cases;
- payment events;
- merchant principal reporting;
- revenue;
- referral liability;
- gas sponsorship;
- webhooks;
- API keys;
- idempotency conflicts;
- rate-limit/security events;
- audit logs;
- tickets;
- system health.

Sensitive actions require:

- explicit backend authorization;
- audit logging;
- idempotency where applicable;
- safe confirmation UX;
- defined recovery/rollback semantics;
- no arbitrary SQL execution from UI.

Financial correction must use append-only/compensating-entry backend workflows. Never make ledger rows directly editable from an admin screen.

## 14. Frontend reliability gate

Every production Pay screen needs defined handling for:

- initial loading;
- slow loading;
- empty result;
- stale result;
- transient error;
- retryable error;
- terminal error;
- unauthorized;
- forbidden;
- expired session;
- expired Payment Intent where relevant;
- network/provider outage where relevant;
- partial data;
- conflicting/ambiguous server state.

Never hide an unknown state behind a false success or a generic spinner.

## 15. i18n and accessibility gate

Required locales:

- `fa-IR`
- `en-US`
- `ar`
- `ru`

RTL/LTR must be structural, not cosmetic.

Audit:

- direction-sensitive layout;
- numbers and monetary formatting;
- dates/timezones;
- truncation of wallet/signature strings;
- keyboard navigation;
- focus management;
- screen-reader labels;
- semantic controls;
- color-independent status communication;
- reduced-motion behavior;
- mobile touch targets.

No user-facing feature logic should depend on hard-coded language strings.

## 16. Security and privacy gate

Reject any implementation that:

- puts secrets in URLs;
- logs secrets;
- sends private keys/seed phrases to backend;
- stores private keys in unsafe browser persistence;
- exposes service-role credentials;
- exposes internal JWT signing keys;
- uses client-controlled merchant IDs as authorization;
- trusts client-calculated financial values;
- trusts transaction signatures as payment success;
- bypasses the approved server-mediated boundary;
- adds permissive fallback authorization;
- weakens RLS to make the frontend work.

Also verify CSP, CORS, cookie security, CSRF protections where applicable, rate limiting, request size limits, replay/idempotency controls and secret redaction in logs/telemetry.

## 17. Database/RLS gate

RLS being enabled is not sufficient.

For every Pay table, verify:

- intended policies exist;
- policy expressions are tenant-safe;
- SELECT/INSERT/UPDATE/DELETE behavior is intentional;
- grants do not bypass policy intent;
- SECURITY DEFINER helpers are minimal and protected;
- search paths are safe where applicable;
- service-only tables cannot be accessed by client roles;
- append-only ledgers cannot be modified by merchants;
- secrets/ciphertexts are never returned to client roles;
- cross-merchant access is denied.

Run adversarial tests, not only happy-path tests.

## 18. Migration/release-history gate

Production schema is authoritative.

Before migration-history repair or Pay migration application:

- freeze Production schema evidence;
- validate the canonical baseline;
- replay migrations on disposable infrastructure;
- compare schema equivalence;
- verify migration ordering;
- verify migration ledger state;
- keep Pay migrations separate from baseline recovery;
- perform post-change Production revalidation.

Never rename historical migrations to guess remote identities. Never create fake historical stubs. Never treat migration metadata repair as schema rollback.

## 19. CI and evidence gate

A release candidate is not PASS until relevant evidence exists for:

- typecheck;
- lint;
- unit tests;
- component tests;
- integration tests;
- E2E;
- security tests;
- database/RLS tests;
- migration validation;
- build;
- browser verification;
- accessibility;
- responsive behavior;
- production configuration validation;
- current-head CI.

The evidence must correspond to the exact commit being released.

## 20. Build Web Apps execution protocol

For each task:

1. Identify the exact repository HEAD.
2. Read the relevant Pay specification.
3. Read the relevant backend/API contract.
4. Inspect the actual implementation.
5. Inspect current database/RLS state if the task crosses that boundary.
6. State blockers before coding.
7. Implement the smallest contract-driven change.
8. Run targeted tests.
9. Run broader regression tests appropriate to the change.
10. Verify the rendered/browser behavior.
11. Verify RTL/LTR and accessibility for UI changes.
12. Re-check security boundaries.
13. Re-check that no mock or invented contract entered the production path.
14. Record exact commit/PR and validation evidence.
15. Report PASS, BLOCKED or UNKNOWN with reasons.

## 21. Definition of Done

A Pay feature is DONE only when:

- its backend contract exists and is verified;
- authorization exists and is tested;
- RLS/grants are verified;
- data ownership boundaries are tested;
- financial semantics are authoritative on the server;
- UI states cover normal and exceptional paths;
- secrets are protected;
- i18n/accessibility/responsive behavior are validated;
- tests pass on the exact candidate commit;
- production configuration is verified;
- rollback/recovery semantics are known where relevant;
- no release blocker remains.

If any condition is missing, status is not DONE.

## 22. Current project release direction

The correct order remains:

`Repository -> Backend Contract -> Authorization/RLS -> Payment Lifecycle -> Checkout -> Merchant Operations -> Referral/Accounting -> Operator Console -> E2E -> Security Audit -> Performance/Accessibility -> Production Release`

The existence of a frontend skill does not authorize `/pay` activation.

The frontend remains a projection of the real Pay system until every release gate is satisfied.
