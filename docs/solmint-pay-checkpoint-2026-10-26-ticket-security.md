# SolMint Pay checkpoint — 2026-10-26 Ticket moderation and request security

## Current status

**IMPLEMENTED IN PR / NOT YET DEPLOYED**

- Base: `main` at `c7fd2c5bf6ed85432cdeafa58079e21b7ed20bc2`
- Feature branch: `feat/pay-ticket-moderation-security`
- Pull request: [#344](https://github.com/azad2022/solsite/pull/344)
- Validated code head at checkpoint: `2ef939e1e6eba00560fd74eb1dd2cbbf194f1cf9`

Production migration and deployment have **not** been executed.

## Discovery findings

Existing ticket capabilities:
- Listing tickets, reading conversation messages, replying, and changing status already existed.
- Ticket creation already required JSON parsing, a maximum request-body size, subject/message length limits, a priority allowlist, parameterized database RPC calls, and React text rendering.
- Ticket list/detail reads did not have a dedicated rate limit; write limits were incomplete and there was no ticket-specific edge-IP limiter.
- Administrator ticket deletion and Pay-support-only user blocking were missing.

The audited source path does not evaluate submitted ticket text as code or render it through `dangerouslySetInnerHTML`. This source-level check does not claim a full external penetration test.

## Implemented in PR #344

- Admin-only ticket soft deletion, with audit event and retained conversation history. Normal ticket/message reads hide deleted entries.
- Admin-only block/unblock of the ticket creator, requiring a 3–500 character reason and confirmation in the UI.
- Separate admin list of blocked support users, so an unblock remains possible even if the ticket that led to the block is deleted.
- Block enforcement in the database create/reply functions as well as API prechecks. It restricts SolMint Pay support activity only; it does not deactivate the user's general SolMint account.
- Per-user and Cloudflare edge-IP request limits on ticket list, detail, create, reply, status, delete, moderation, and blocked-user management.
- HTTP 429 responses include `Retry-After`; writes require `application/json`.
- Added focused service and security-contract tests and four-locale UI strings.

## Validation evidence for code head `2ef939e1e6eba00560fd74eb1dd2cbbf194f1cf9`

- CI / Quality (run `40293050199`): **PASS** — includes production-source typecheck, build, and unit tests.
- SolMint Pay Database Security (run `40293050202`): **PASS** — repository migration-chain validation and existing database-security suite passed. This does not indicate the production migration was applied.
- SolMint Pay Devnet E2E (run `40293050205`): **PASS**.
- SolMint Pay Mainnet Read-only (run `40293050236`): **PASS**.
- Dedicated Production Build (run `40293050226`): **PENDING** at the time this checkpoint was written.
- Production browser/E2E coverage for the new delete/block controls has not been run against a migrated production deployment.

## Release gate / remaining work

1. Dedicated Production Build must finish successfully for the final PR head.
2. PR #344 must be merged through the repository's normal release path.
3. Apply `supabase/migrations/20261026140000_solmint_pay_ticket_moderation_security.sql` using the repository's `SolMint Pay Production Migration` workflow with its explicit `confirm=APPLY` input.
4. Verify post-deployment ticket listing, reply, soft delete, block and unblock flows using an authenticated admin and merchant, plus 401/403/429 behavior. Confirm the migration and production data access before calling the feature complete.

No production database writes or deployment were performed during this implementation checkpoint.
