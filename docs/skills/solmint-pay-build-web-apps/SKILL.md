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
A successful build alone never proves production readiness. Validate the relevant backend contract, database/RLS boundary, security controls, runtime configuration, tests, and deployment evidence. Missing evidence is `UNKNOWN` or `BLOCKED`, never an assumption.
