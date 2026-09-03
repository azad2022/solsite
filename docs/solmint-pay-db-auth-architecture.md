# SolMint Pay — DB, RLS and Authentication Mapping

Status: Architecture decision recorded; production database deployment intentionally not performed.

## Scope

This document records the security boundary for SolMint Pay while the website still uses the existing Solmint server-session authentication model. It is an implementation contract for the current Pay foundation and a migration guard for the future unified Email/Google authentication work.

## Current identity model

The existing Solmint website authenticates users through the application-owned session layer and the `public.users` table. The current session is represented by the `__Host-solmint_session` HttpOnly/Secure/SameSite=Strict cookie and resolved server-side before Pay merchant operations.

`public.pay_merchants.owner_user_id` and `public.pay_merchant_members.user_id` reference `public.users(id)` and therefore remain compatible with the current site identity model.

Pay must not invent a second browser login or a second user identity. A future unified authentication project may replace the underlying authentication mechanism with Supabase Auth Email/Google identities, but the Pay tenant model must continue to resolve to one Solmint user identity.

## Current Pay data-plane boundary

The Pay database is intentionally server-mediated. The Pay lockdown migration enables RLS on the Pay tables and revokes all table privileges from `anon` and `authenticated`. This prevents browser clients from directly querying or mutating Pay tables through the Supabase Data API.

All current Pay server operations use a trusted backend credential and must perform application-level authentication and merchant authorization before selecting or mutating Pay records.

This is deliberate: the current browser session is not a Supabase Auth JWT, so `auth.uid()` cannot be treated as the source of the current application's user identity yet. Adding `auth.uid()` policies before an Auth migration would produce a false sense of tenant isolation rather than a valid enforcement path.

## Mandatory authorization rules

1. Merchant creation derives the owner from the already authenticated Solmint session. A caller must never be able to select an arbitrary owner user ID.
2. Merchant-scoped browser operations must resolve the current session to a Solmint user and verify ownership or an active membership role before accessing the merchant.
3. API-key operations derive `merchant_id` from the authenticated Pay API credential; request bodies and URL parameters are not authoritative for tenant identity.
4. Payment, transaction, transfer, event, ledger, webhook, API-key, rate-limit and audit records are always reached through a verified merchant boundary.
5. Credentials and webhook secret material remain server-only. Browser roles have no direct table access.
6. Financial and reconciliation functions remain service-side atomic operations and must continue to fail closed on missing, inactive or mismatched merchant state.

## Ownership versus membership

`pay_merchant_members` is the durable RBAC boundary for future multi-user merchants. The current implementation preserves a single active owner and creates the owner membership atomically with merchant creation.

Until Dashboard membership management exists, owner checks remain the authorization rule for sensitive wallet-management operations. Future roles (`admin`, `finance`, `developer`, `viewer`) must not automatically inherit owner capabilities; each operation must define its required role explicitly.

## RLS posture

RLS is required on every Pay table before production deployment. Direct `anon`/`authenticated` table access must remain denied. When the unified Supabase Auth model is introduced, selected read/write operations may be exposed through narrowly scoped policies that use `auth.uid()` (or a controlled RBAC claim) and the merchant membership mapping.

Until that migration is complete, the server-mediated boundary is the authoritative browser-access control and RLS remains defense-in-depth against accidental direct table exposure.

## SECURITY DEFINER rules

Every Pay `SECURITY DEFINER` function must:

- set `search_path = ''`;
- use schema-qualified object names;
- have the minimum possible executable roles;
- remain non-callable by `public`, `anon` and `authenticated` unless there is a separately reviewed policy proving that exposure safe;
- enforce all security-sensitive invariants inside the function transaction where the function owns the invariant.

## Production DB deployment rule

The connected Supabase production project currently does not contain the `pay_*` schema. No Pay migration is to be applied to production merely because the repository migrations are complete.

Before first deployment, the complete Pay migration chain must be applied to a controlled database environment, followed by schema verification, privilege/RLS verification, adversarial tenant tests, migration audit and the remaining production release gates.

## Release blockers from this stage

- The existing Pay schema is not deployed in the connected production Supabase database.
- There is no valid `auth.uid()`-based RLS identity path while the website uses its current custom session.
- Browser access to Pay data must remain server-mediated until the unified authentication architecture is deliberately migrated.
- Membership management and role-specific Dashboard authorization are not yet productized.

These are known architectural boundaries, not reasons to weaken the current lockdown.
