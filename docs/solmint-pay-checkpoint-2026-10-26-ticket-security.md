# SolMint Pay checkpoint — 2026-10-26 Ticket moderation and request security

## Status

**DATABASE MIGRATION APPLIED / APPLICATION RELEASE PENDING**

- Base main at task start: `c7fd2c5bf6ed85432cdeafa58079e21b7ed20bc2`
- Feature branch: `feat/pay-ticket-moderation-security`
- Pull request: [#344](https://github.com/azad2022/solsite/pull/344)
- Validated application/schema code head before migration version alignment: `dd1394dc5d5deb4dd55fe24ac7de8b21bd0cd438`
- Migration is applied to the production Supabase database and recorded as version `20261026090718` (`solmint_pay_ticket_moderation_security`).

The migration was applied to production after all PR gates were green and live RLS/function signatures were checked. The frontend/API code has not yet been deployed.

## Discovery findings

Existing ticket capabilities:
- Listing tickets, reading ticket conversations, replying, and changing ticket status were already implemented.
- Ticket creation already parsed a bounded JSON object, enforced subject/message lengths and a priority allowlist, called parameterized database RPCs, and rendered message bodies as React text rather than HTML.
- Source inspection found no use of `dangerouslySetInnerHTML` for ticket content; no execution of submitted ticket text as SQL or HTML was identified. This is source-level evidence, not a claim that a full external penetration test was performed.
- Ticket list/detail reads lacked ticket-specific rate limiting, the endpoint set had no IP-based ticket buckets, and administrator ticket delete / support-only user block management were missing.

## Implemented in PR #344

- Administrator-only ticket soft-delete. Deleted tickets disappear from normal ticket/message reads; conversation messages remain stored, and a `ticket.deleted` audit event identifies the actor.
- Administrator-only block/unblock for the ticket creator, with a 3–500 character reason and confirmation in the UI.
- A separate blocked-support-users list allows unblocking even if the only ticket used to block the user was deleted.
- User blocks affect **SolMint Pay support activity only**, not the user's general SolMint account.
- The ticket-create and reply database functions enforce support blocks as well as the API prechecks.
- Per-user and Cloudflare edge-IP rate limits cover ticket list/detail/create/reply/status/delete/moderation and blocked-user management. HTTP 429 responses include `Retry-After`.
- Write requests require `application/json`; existing body-size and field-length limits remain active.
- UI messages, errors, confirmations, and support-block states are localized for `fa-IR`, `en-US`, `ar`, and `ru`.
- Added service/security-contract tests and an isolated PostgreSQL test workflow that applies the actual ticket moderation migration.

## Validation evidence for code head `dd1394dc5d5deb4dd55fe24ac7de8b21bd0cd438`

| Gate | Result | Evidence |
|---|---|---|
| CI / Quality, source typecheck and unit tests | **PASS** | Run `40293874265` |
| Production Build | **PASS** | Run `40293874331` |
| SolMint Pay Database Security | **PASS** | Run `40293874366` |
| SolMint Pay Devnet E2E | **PASS** | Run `40293874464` |
| SolMint Pay Mainnet Read-only | **PASS** | Run `40293874418` |

The Database Security workflow:
- validated the migration chain;
- applied `20261026090718_solmint_pay_ticket_moderation_security.sql` to an isolated PostgreSQL fixture;
- passed database tests for text payload storage, blocked ticket creation/replies, soft-delete and audit retention, unblocking after ticket deletion, non-admin denial, administrator-block prevention, and privilege/RLS boundaries;
- then passed the repository's existing Pay identity/RLS security tests after the new fixture was ordered to avoid PostgreSQL cluster-role collisions.

These results validate the PR code and an isolated database fixture. They do **not** mean the migration has been applied to production or that new moderation controls have been browser-tested in production.

## Release gate / remaining work

1. Review and merge PR #344 through the repository's normal release process.
2. Apply migration `20261026090718_solmint_pay_ticket_moderation_security.sql` through the repository's `SolMint Pay Production Migration` workflow using its explicit `confirm=APPLY` input; do not deploy API code before the schema migration is applied.
3. Verify production post-deployment flows with authenticated admin and merchant sessions: list/read/reply, soft-delete, block/unblock, 401/403/429, request body/content-type rejection, and RLS visibility of deleted records.
4. Only mark this feature **production complete** after migration state and production smoke evidence are observed.

The production database migration was applied; no application deployment was performed during this checkpoint.
