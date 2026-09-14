-- A payment intent must have one unambiguous active verified receiving wallet.
-- Multiple wallet choices are not allowed to be resolved implicitly by runtime.
create unique index if not exists pay_merchant_one_active_verified_receiving_wallet_uidx
  on public.pay_merchant_wallets (merchant_id)
  where wallet_role = 'receiving'
    and is_active = true
    and verification_status = 'verified';

comment on index public.pay_merchant_one_active_verified_receiving_wallet_uidx is 'Prevents ambiguous merchant settlement destinations: exactly one active verified receiving wallet is required.';
