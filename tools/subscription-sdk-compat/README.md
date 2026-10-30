# Subscription SDK Runtime Compatibility Harness

This directory is an isolated, disposable compatibility harness for the pinned upstream release:

- Program: `program-v0.5.0` / `364a41976c33347d092902443bbec2def9227e75`
- TypeScript SDK: `@solana/subscriptions@0.5.0` / `ts-client-v0.5.0` / `5a347ffaa969036061d274d3c91e0277962e2b51`
- Kit: `@solana/kit@7.0.0`
- SolMint transaction boundary: `@solana/web3.js@1.99.0`
- Local Pages runtime: Wrangler `4.156.0`, compatibility date `2026-08-10`

The harness is outside the root application package. It does not add SDK dependencies to the production browser bundle and must not be imported by the live site as part of this checkpoint.

## Checks

1. Load the pinned SDK, Kit and web3.js under Node.js 24.
2. Derive Plan, SubscriptionAuthority and Subscription PDAs in Kit and compare them with web3.js derivation using the pinned Program ID and exact seeds.
3. Build InitSubscriptionAuthority, CreatePlan and Subscribe instructions through the upstream SDK builders using address-only test doubles.
4. Convert Kit instructions to web3.js `TransactionInstruction` and verify data bytes, account order, signer flags and writable flags against the SDK-built fixture.
5. Serialize and deserialize unsigned legacy and v0 web3.js transactions.
6. Start a local Cloudflare Pages Functions server with the pinned Wrangler CLI. The Pages Function imports the real SDK and adapter, exercises the SDK instruction builder and conversion in the local Workerd runtime, and verifies the Node compatibility imports required by the dependency graph (`node:events`, `node:path`, `node:fs/promises`, and `Buffer`).

The Pages test uses only local synthetic addresses and a no-op test signer. It does not use RPC, secrets, private keys, customer data or a real wallet. It never signs or submits a transaction and does not deploy to Cloudflare.

## Reproduce

From this directory:

```bash
npm ci
npm test
npm run test:workerd
```

`npm run test:workerd` runs `wrangler pages dev` locally against this directory's isolated `wrangler.toml`. It does not use the root production configuration or change Cloudflare settings.

## Decision rule

Node.js tests do not prove Workerd behavior. A successful local Pages test proves only that this pinned SDK instruction-builder/conversion fixture imports and executes in the configured local Pages runtime; it does not prove production deployment, signer custody, RPC/simulation, Program IDL consistency, deployed ProgramData identity, payment verification, accounting or end-to-end Subscription lifecycle correctness.

The package lock must be committed and checked with `npm ci` before dependency reproducibility can pass. Engine requirements of every installed dependency must be respected; Node.js 22 is not accepted for this isolated harness because the pinned Token packages declare Node.js >=24.
