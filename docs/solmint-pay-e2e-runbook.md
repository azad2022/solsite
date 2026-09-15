# SolMint Pay E2E Runbook

This document records the controlled production E2E prerequisites and boundaries for SolMint Pay.

The Payment Intent creation E2E uses the existing controlled wallet key only to derive its public key and produce the off-chain wallet ownership signature. It must not require the production application dependency graph to include a Solana transaction SDK.

The E2E workflow must keep cryptographic signing isolated to the CI-only test environment and must never log or persist secret key material.

A successful Payment Intent creation E2E proves the backend-authoritative creation/read/idempotency contract. It does not prove on-chain payment, verification, finality, settlement, reconciliation, or refund behavior.
