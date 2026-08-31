-- SolMint Pay is server-mediated. No browser/client role may directly query or mutate
-- payment, accounting, credential, rate-limit, webhook, or wallet-challenge tables.
-- The existing server-side authentication layer uses privileged server credentials;
-- this migration therefore keeps the client roles completely outside the Pay data plane.

alter table public.pay_merchants enable row level security;
alter table public.pay_merchant_wallets enable row level security;
alter table public.pay_payment_intents enable row level security;
alter table public.pay_payment_transactions enable row level security;
alter table public.pay_payment_links enable row level security;
alter table public.pay_invoices enable row level security;
alter table public.pay_referrals enable row level security;
alter table public.pay_commissions enable row level security;
alter table public.pay_gas_accounts enable row level security;
alter table public.pay_gas_ledger enable row level security;
alter table public.pay_webhooks enable row level security;
alter table public.pay_webhook_deliveries enable row level security;
alter table public.pay_audit_logs enable row level security;
alter table public.pay_idempotency_keys enable row level security;
alter table public.pay_affiliates enable row level security;
alter table public.pay_payment_transfers enable row level security;
alter table public.pay_wallet_challenges enable row level security;
alter table public.pay_payment_events enable row level security;
alter table public.pay_revenue_ledger enable row level security;
alter table public.pay_api_keys enable row level security;
alter table public.pay_rate_limit_buckets enable row level security;

revoke all on table public.pay_merchants from anon, authenticated;
revoke all on table public.pay_merchant_wallets from anon, authenticated;
revoke all on table public.pay_payment_intents from anon, authenticated;
revoke all on table public.pay_payment_transactions from anon, authenticated;
revoke all on table public.pay_payment_links from anon, authenticated;
revoke all on table public.pay_invoices from anon, authenticated;
revoke all on table public.pay_referrals from anon, authenticated;
revoke all on table public.pay_commissions from anon, authenticated;
revoke all on table public.pay_gas_accounts from anon, authenticated;
revoke all on table public.pay_gas_ledger from anon, authenticated;
revoke all on table public.pay_webhooks from anon, authenticated;
revoke all on table public.pay_webhook_deliveries from anon, authenticated;
revoke all on table public.pay_audit_logs from anon, authenticated;
revoke all on table public.pay_idempotency_keys from anon, authenticated;
revoke all on table public.pay_affiliates from anon, authenticated;
revoke all on table public.pay_payment_transfers from anon, authenticated;
revoke all on table public.pay_wallet_challenges from anon, authenticated;
revoke all on table public.pay_payment_events from anon, authenticated;
revoke all on table public.pay_revenue_ledger from anon, authenticated;
revoke all on table public.pay_api_keys from anon, authenticated;
revoke all on table public.pay_rate_limit_buckets from anon, authenticated;

comment on table public.pay_api_keys is 'Server-mediated only; client roles have no direct access.';
comment on table public.pay_rate_limit_buckets is 'Server-mediated only; client roles have no direct access.';
