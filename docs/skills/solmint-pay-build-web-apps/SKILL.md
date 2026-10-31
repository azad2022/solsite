# SolMint Pay — Build Web Apps Skill

This document defines the project workflow. Repository code, backend contracts, database schema/RLS, migrations, tests, and production evidence are authoritative.

## Required discovery
Before Pay implementation, inspect the current `main` HEAD, repository structure, routes, API/service layers, domain types, authentication, authorization, Pay migrations/RLS, blockchain verification, webhook/reconciliation/accounting paths, tests, CI, and deployment configuration.

## Non-negotiable rules
- Never invent endpoints, fields, states, roles, permissions, RPCs, financial rules, or security assumptions.
- Frontend is presentation and interaction only. Backend, database, and blockchain verification are authoritative.
- Never expose passwords, API secrets, webhook secrets, private keys, seed phrases, or internal JWT signing material to the browser.
- Sensitive Supabase/RPC operations remain server-mediated.
- A submitted signature, reference, webhook, or browser state is never proof of payment completion.
- Merchant isolation must be enforced by backend authorization and database/RLS, not UI checks.
- Mock data must never enter a production execution path.

## Pay UX
Keep Checkout, Dashboard, Transactions, Merchants, Customers, Invoices, Referrals, Tickets, Reports, Developer, and Security as distinct product boundaries. Preserve backend payment states and clearly distinguish submitted → detected → verifying → confirming → completed/other authoritative outcomes.

## i18n and accessibility
Support `fa-IR`, `en-US`, `ar`, and `ru` with true RTL/LTR behavior. Do not hard-code user-facing feature strings. Important states include loading, empty, error, unauthorized, forbidden, stale, and retryable. Responsive behavior, keyboard access, semantic structure, reduced motion, and accessible names are part of Definition of Done.

## Testing
Use the Build Web Apps testing workflow for meaningful frontend changes. Important Pay capabilities should follow Unit → Component → Integration → E2E → Security → CI. Where supported by the real backend contract, cover valid, underpaid, overpaid, wrong token, wrong destination, wrong reference, failed, expired, duplicate, replay, ambiguous, RPC failure, and incomplete discovery cases.

## Release discipline
A successful build alone never proves production readiness. Validate the relevant backend contract, database/RLS boundary, security controls, runtime configuration, tests, production deployment, and post-deployment smoke evidence. Recovery must remain source-controlled and use the normal deployment path. Manual GitHub Ruleset/Branch Protection setup, Cloudflare dashboard changes, Cloudflare API tokens, or other provider-management secrets are not implementation prerequisites for Pay release and must not be assigned to the project owner as a required step. Missing evidence for a critical technical gate is `UNKNOWN` or `BLOCKED`, never an assumption.

## Subscription Billing boundary
For any Subscription/Recurring Billing UI, read docs/skills/solmint-pay-subscriptions/SKILL.md before changing code. A Skill or roadmap entry does not prove the feature, API, schema, or on-chain integration exists. Re-discover the actual Backend contract and schema first.

Treat Subscription Plans, Subscriptions, Consent, on-chain delegation, Billing Cycles/Attempts, Payment Intents, Verification and Accounting as separate domain states. Frontend only presents and interacts with backend-authoritative data; never schedule billing, calculate financial truth, retry a charge, sign a Collector transaction, or infer success from submitted Signature, Program event alone, Reference, or Webhook.

Customer consent UI must display the exact immutable terms snapshot returned by the Backend, including amount, fixed-hours/calendar period distinction, mint/network, fee/payer, destination, first/next charge, cancellation/revocation semantics and the actual token-delegation scope. The official program's Token Delegate approval is u64::MAX; Plan/Subscription rules enforce effective per-period limits. Never describe this as a wallet-level exact-amount/one-period allowance. Do not display unsupported promises such as calendar-month billing, trial, proration, or maximum total charge count.

Keep Subscription lifecycle, on-chain authority state, Billing Attempt, Payment Intent and financial outcome distinct. Preserve loading, empty, error, unauthorized, forbidden, stale and retryable states; support fa-IR/en-US/ar/ru with real RTL/LTR. Sensitive operations stay server-mediated.


## Additional Subscription UX/security boundary — 2026-10-30

- Do not render a paid/active service state from the on-chain Subscription PDA alone. The customer may have revoked the shared ATA delegate or made the token account uncollectable while the Program still reports the Subscription as active. Only backend-authoritative entitlement based on verified transfer/accounting evidence may unlock or renew service.
- Consent must explain the shared `SubscriptionAuthority` delegate approval of `u64::MAX`, that effective limits live in Plan/Subscription program state, that the authority is shared per customer+mint, and that initializing it can replace an existing SPL Token delegate. A shared-authority revoke can affect other subscriptions for the same customer+mint.
- Production v1 uses separate customer-signed transactions for authority initialization and Subscribe. The Subscribe builder must use the actual fetched `init_id`; never use `UNKNOWN_INIT_ID` or combine init+subscribe in one held transaction.
- Do not accept durable-nonce or unresolved smart-wallet/multisig proposals in consent/control flows until their delayed execution/cancellation lifecycle is implemented and verified. A browser Cancel action is not proof that a signed proposal or transaction cannot later execute.
- Distinguish Plan Sunset from stopping existing pulls; distinguish normal cancellation (may remain collectible through current period), dual-signed immediate cancellation, one-subscription close, and shared authority revoke. State which operations can affect other subscriptions.
- Plan Owner is always an authorized Puller and can pull outside the Collector. Merchant UI must not imply that Collector is the exclusive charging actor. Display period usage/last verified pull only from backend evidence that reconciles every authorized Puller.
- Empty destination allowlists mean any destination on-chain; do not present or create an unrestricted Plan. The allowlist is checked against destination token-account owner, not only its ATA address. A separate gateway-fee leg requires a second allowed owner and an independently verified same-transaction accounting design.
- The Program period is fixed hours. Missed periods are not automatically accrued as one debt per missed cycle. Do not show catch-up promises or calendar-month wording without a separate tested backend contract.
- Do not enroll in a finite Plan with less than one full period remaining under the default v1 profile. Show exact Plan end time and first/next charge semantics from the immutable consent snapshot.
- Keep pending approval, submitted, outcome unknown, finalized/verified, collectability, entitlement and accounting states distinct. A transaction signature or emitted event alone never means paid.