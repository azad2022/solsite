# SolMint Pay — Payment Intent API Contract

The create and replay paths for a Payment Intent must return the same authoritative snapshot shape consumed by Checkout and the Payment Intent service.

Required snapshot fields include merchant identity, amountAtomic, asset, token metadata, recipient, reference, fee policy, feeAtomic, feeRecipient, gasSponsored, status, expiresAt, customerTotalAtomic, merchantNetAtomic, merchantSettlementAtomic, network, and verificationCommitment.

The database routine remains authoritative for persisted financial values and idempotency. The response projection must not calculate a different financial result; it only serializes the persisted snapshot into the public API contract.

Replay must return the exact previously stored response body for the same merchant, scope, idempotency key, and request hash. A conflicting request remains an idempotency conflict.
