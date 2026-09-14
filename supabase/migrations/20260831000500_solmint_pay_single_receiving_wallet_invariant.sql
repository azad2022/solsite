-- Exactly one active, verified receiving wallet is a payment invariant.
-- Wallet rotation is performed transactionally by the verification RPC.

create unique index if not exists pay_merchant_one_active_verified_receiving_wallet_uidx
  on public.pay_merchant_wallets (merchant_id)
  where wallet_role = 'receiving'
    and is_active = true
    and verification_status = 'verified';

comment on index public.pay_merchant_one_active_verified_receiving_wallet_uidx
  is 'Ensures a merchant has at most one active verified receiving wallet. Wallet rotation must happen atomically.';
