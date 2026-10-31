# Subscription SDK Runtime Compatibility Harness

This directory is an isolated, disposable compatibility harness for the pinned upstream release:

- Program: `program-v0.5.0` / `364a41976c33347d092902443bbec2def9227e75`
- TypeScript SDK: `@solana/subscriptions@0.5.0` / `ts-client-v0.5.0` / `5a347ffaa969036061d274d3c91e0277962e2b51`
- Kit: `@solana/kit@7.0.0`
- SolMint transaction boundary: `@solana/web3.js@1.99.0`
- Typed adapter: TypeScript, compiled with the repository-pinned TypeScript toolchain
- Local Pages runtime: Wrangler `4.156.0`, compatibility date `2026-08-10`

The harness is outside the root application package. It does not add SDK dependencies to the production browser bundle and must not be imported by the live site as part of this checkpoint.

## Checks

1. Load the pinned SDK, Kit and web3.js under Node.js 24.
2. Derive Plan, SubscriptionAuthority and Subscription PDAs in Kit and compare them with web3.js derivation using the pinned Program ID and exact seeds.
3. Build InitSubscriptionAuthority, CreatePlan and Subscribe instructions through the upstream SDK builders using address-only test doubles.
4. Convert Kit instructions to web3.js `TransactionInstruction` through the typed adapter.
5. Compare Init Authority, Create Plan and Subscribe instruction bytes and account metas against independent golden fixtures transcribed from the pinned `program-v0.5.0` IDL; the fixture records the Program commit and IDL Git blob.
6. Serialize and deserialize unsigned legacy and v0 web3.js transactions.
7. Compile the typed adapter and SDK instruction-builder call sites with the repository-pinned TypeScript compiler.
8. Start a local Cloudflare Pages Functions server with the pinned Wrangler CLI.
9. Query the dedicated Devnet RPC, verify the Program account is executable, and simulate a synthetic CreatePlan instruction with signature verification disabled. This test does not submit or sign a transaction. The Pages Function imports the real SDK and adapter, exercises the SDK instruction builder and conversion in the local Workerd runtime, and verifies the Node compatibility imports required by the dependency graph (`node:events`, `node:path`, `node:fs/promises`, and `Buffer`).
10. In a separate read-only Mainnet job, verify cluster genesis, Program account/Upgradeable Loader state, derived ProgramData PDA, deployment slot, upgrade authority, and SHA-256 of the deployed ELF. This job consumes the existing `SOLANA_RPC_URL` GitHub Actions secret; it has no public RPC fallback and never logs or writes the endpoint/API key.

The Pages test uses only local synthetic addresses and a no-op test signer. It does not use RPC, secrets, private keys, customer data or a real wallet. It never signs or submits a transaction and does not deploy to Cloudflare.

The Devnet simulation uses only the public key of the existing Devnet test fee payer and the dedicated `SOLANA_DEVNET_RPC_URL` GitHub secret. It never reads a private key, signs, submits, creates an on-chain Plan, or mutates Devnet. The RPC method allowlist excludes transaction submission methods.

The Mainnet ProgramData probe uses only `getGenesisHash` and `getAccountInfo` against the dedicated `SOLANA_RPC_URL` GitHub Actions secret. It requires an HTTPS Helius RPC hostname (no public RPC fallback), validates the Mainnet genesis hash and loader account layout, and writes a metadata-only evidence artifact containing ProgramData address, deployment slot, upgrade authority and ELF SHA-256. It excludes the RPC URL/API key and raw executable bytes. This Mainnet proof is separate from the isolated SDK compatibility PASS and remains BLOCKED if the GitHub secret is unavailable.

## Reproduce

From the repository root, install the root toolchain, then run the isolated harness:

```bash
bun install --frozen-lockfile
cd tools/subscription-sdk-compat
npm ci
npm run typecheck
npm test
npm run test:workerd
SOLANA_DEVNET_RPC_URL=<configured-secret> npm run test:devnet-sim
SOLANA_RPC_URL=<configured-mainnet-secret> npm run test:mainnet-programdata
```

`npm run test:workerd` runs `wrangler pages dev` locally against this directory's isolated `wrangler.toml`. It does not use the root production configuration or change Cloudflare settings.

## Decision rule

Node.js tests do not prove Workerd behavior. A successful local Pages test proves only that this pinned SDK instruction-builder/conversion fixture imports and executes in the configured local Pages runtime; it does not prove production deployment, signer custody, RPC/simulation, Program IDL consistency, deployed ProgramData identity, payment verification, accounting or end-to-end Subscription lifecycle correctness.

The package lock must be committed and checked with `npm ci` before dependency reproducibility can pass. The root TypeScript compiler is pinned by the repository `bun.lock`. Engine requirements of every installed dependency must be respected; Node.js 22 is not accepted for this isolated harness because the pinned Token packages declare Node.js >=24.
