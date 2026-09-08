# SolMint Pay Merchant Onboarding Release

This branch wires the existing merchant and wallet-proof backend contracts into the Pay frontend.

The frontend never creates a receiving wallet on behalf of the merchant and never handles a private key or seed phrase. It asks the user's browser wallet provider to connect and sign a server-issued, short-lived ownership challenge.

The production database remains free of fixtures. No test payment or fake merchant data is inserted by this change.
