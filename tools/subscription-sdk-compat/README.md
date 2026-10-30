# Subscription SDK Compatibility Spike

This directory is an isolated, disposable compatibility harness for the pinned upstream release:

- Program: `program-v0.5.0` / `364a41976c33347d092902443bbec2def9227e75`
- TypeScript SDK: `@solana/subscriptions@0.5.0` / `ts-client-v0.5.0` / `5a347ffaa969036061d274d3c91e0277962e2b51`
- Kit: `@solana/kit@7.0.0`
- SolMint transaction boundary: `@solana/web3.js@1.99.0`

The harness is deliberately outside the root application package. It does not add dependencies to the production browser bundle and must not be imported by Pages Functions or the live site as part of this checkpoint.

## Checks

1. Load the pinned SDK, Kit and web3.js under Node 22 and Node 24.
2. Derive Plan, SubscriptionAuthority and Subscription PDAs in Kit and compare them with web3.js derivation using the pinned Program ID and exact seeds.
3. Build InitSubscriptionAuthority, CreatePlan and Subscribe instructions through the upstream SDK builders. The fixture uses address-only test doubles and synthetic terms; it does not sign or submit a transaction.
4. Convert Kit instructions to web3.js `TransactionInstruction`, asserting program address, exact data bytes, account order and all signer/writable flags.
5. Serialize and deserialize unsigned legacy and v0 web3.js transactions.
6. Bundle an isolated Worker entry using esbuild's `workerd` export condition. This is a bundle-resolution check, not a deployed Cloudflare Worker test.

No RPC is called, no keypair/private key is used, no wallet signs, and no blockchain state is mutated.

## Reproduce

From this directory:

```bash
npm install --package-lock-only
npm ci
npm test
npm run build:workerd
```

The workflow creates a temporary exact dependency lock during CI and uploads it with the bundle as an evidence artifact. A later checkpoint can promote a reviewed lockfile/adapter into a maintained isolated service package; this spike is not production integration.

## Decision rule

A successful Node 22 test does not override a dependency's declared `engines.node >=24`. Engine metadata, Node runtime tests, and Workerd bundling must be reported separately. Workerd bundle success alone does not prove Worker runtime behavior, signer compatibility, RPC compatibility, or a safe transaction submission path.
