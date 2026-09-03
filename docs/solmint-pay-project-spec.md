# SolMint Pay — Historical Project Specification

> **Status: SUPERSEDED.**
>
> This document is retained only for historical context. It is no longer an independent source of truth for SolMint Pay.
>
> The authoritative V1 product and engineering contract is:
>
> `docs/solmint-pay-v1-product-contract.md`
>
> The authoritative continuation/engineering handoff is:
>
> `docs/solmint-pay-continuation.md`
>
> Do not implement, audit, or change Pay behavior from this document. If historical material here appears to conflict with the current V1 contract, the V1 contract wins and the historical text must not be reintroduced without an explicit product decision.

## Why this file remains

The original specification accumulated product and engineering decisions during the early design phase. It is preserved in Git history so those decisions remain auditable, but keeping a second active specification creates a direct risk of inconsistent instructions between engineering sessions.

For all future work, use the following order:

1. `docs/solmint-pay-v1-product-contract.md` — product/economic/security authority.
2. `docs/solmint-pay-continuation.md` — current operational facts, workflow rules, and safe continuation procedure.
3. Lower-level Pay documentation — implementation detail.
4. Current source code, migrations, tests, CI and runtime/database observations — evidence.
