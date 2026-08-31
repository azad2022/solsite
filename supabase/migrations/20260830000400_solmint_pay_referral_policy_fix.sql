-- Referral economics must be an explicit product decision, not an accidental
-- database default. Existing rows keep their captured rate; future affiliate
-- creation must receive a server-resolved policy before activation.
alter table public.pay_affiliates
  alter column commission_rate_bps set default 0;

comment on column public.pay_affiliates.commission_rate_bps is 'Server-resolved affiliate commission policy in bps. Default 0 until the production referral economics are explicitly configured.';

-- The old mutable SOL balance is not an accounting source of truth. Credits and
-- sponsorship debits must come from pay_gas_ledger and be reconciled on-chain.
comment on column public.pay_gas_accounts.sol_balance_atomic is 'Legacy cached balance; non-authoritative. Production code must derive credit/spend state from pay_gas_ledger plus verified on-chain observations.';
