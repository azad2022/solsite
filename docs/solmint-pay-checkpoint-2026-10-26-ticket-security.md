# SolMint Pay checkpoint — 2026-10-26 Ticket moderation and request security

## Status

**APPLICATION DEPLOYED / SUPPORT MODERATION MIGRATION APPLIED / SECURITY HARDENING RECORDED**

- Base main at task start: `c7fd2c5bf6ed85432cdeafa58079e21b7ed20bc2`
- Feature branch: `feat/pay-ticket-moderation-security`
- Implementation PR: [#344](https://github.com/azad2022/solsite/pull/344), merged at `83083effd062a5eca172606e77f06cb200faad23`
- Follow-up hardening branch: `fix/pay-ticket-moderation-search-path` (PR pending at checkpoint update)
- Validated application/schema code head before migration version alignment: `dd1394dc5d5deb4dd55fe24ac7de8b21bd0cd438`
- Migration is applied to the production Supabase database and recorded as version `20261026090718` (`solmint_pay_ticket_moderation_security`).
- Follow-up hardening migration `20261026091519_solmint_pay_ticket_moderation_search_path_hardening` has also been applied to production. It sets `search_path TO ''` for all seven SECURITY DEFINER ticket mutation RPCs.

The moderation migration was applied after all PR gates were green and live RLS/function signatures were checked. PR #344 was merged and Cloudflare Pages successfully deployed commit `83083eff...`. Production API contract, CI, Production Build, Database Security, Devnet E2E, Mainnet Read-only, Cloudflare Pages, and non-mutating Live Smoke checks passed. The production authenticated Browser UI E2E and Live Browser Audit were still running at the time this checkpoint was updated.

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

## Validation evidence

For PR #344 head `797a7b6c0c83fae5fdef872a8b510e51bdd16986` before merge, the applicable CI, Production Build, Database Security, Devnet E2E and Mainnet Read-only gates all passed. After merge to main at `83083effd062a5eca172606e77f06cb200faad23`, Cloudflare Pages and the production API contract/live smoke passed. The production browser tests were still in progress when recorded.

Historical pre-merge validation evidence for code head `dd1394dc5d5deb4dd55fe24ac7de8b21bd0cd438`:

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

The isolated PostgreSQL workflow also applies the follow-up migration and asserts all seven SECURITY DEFINER ticket RPCs have an empty `search_path`. Live production queries confirmed the table, columns, RPCs, RLS grants, migration versions `20261026090718` and `20261026091519`, and empty `search_path` on all seven functions. The production smoke test passed. Dedicated browser UI E2E and live audit status should be rechecked before claiming direct browser verification of the delete/block controls.

## Follow-up release gate

1. Merge the security-hardening follow-up PR after CI and database security validation pass; its migration version `20261026091519` is already applied in production, so the repository history must retain this exact version.
2. Recheck final production Browser UI E2E and Live Browser Audit results. They were still running when this checkpoint was updated.
3. The admin delete/block/unblock controls are shipped in the Cloudflare Pages deployment. For an authenticated admin browser smoke, verify those specific controls and 401/403/429 behavior as explicit actions; the regular production ticket lifecycle E2E currently covers ticket creation, replies, statuses, tenant isolation and closed-reply rejection, but does not directly exercise block/delete.

No ticket data was created or deleted by the migration/hardening changes. The changes were limited to schema/function settings and tests; the application code has been deployed.
