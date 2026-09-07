-- SolMint Pay: Better Auth -> internal JWT -> PostgREST -> RLS bridge
-- The production database was already migrated with these same statements on 2026-09-08.
-- Keep this file in source control so repository migrations remain aligned.

create or replace function public.pay_request_user_id()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claims jsonb;
  v_user_id text;
begin
  if current_setting('role', true) <> 'authenticated' then
    return null;
  end if;

  begin
    v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    return null;
  end;

  v_user_id := nullif(btrim(v_claims ->> 'solmint_user_id'), '');
  if v_user_id is null or length(v_user_id) > 256 or v_user_id ~ '[^ -~]' then
    return null;
  end if;
  return v_user_id;
end;
$$;

create or replace function public.pay_has_merchant_access(p_merchant_id uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.users u
      join public.pay_merchant_members m on m.user_id = u.id
     where u.id = public.pay_request_user_id()
       and u.is_active = true
       and m.merchant_id = p_merchant_id
       and m.status = 'active'
       and (p_roles is null or m.role = any(p_roles))
  );
$$;

create or replace function public.pay_has_affiliate_access(p_affiliate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.pay_affiliates a
      join public.users u on u.id = a.owner_user_id
     where a.id = p_affiliate_id
       and a.owner_user_id = public.pay_request_user_id()
       and u.is_active = true
       and a.status in ('pending','active')
  );
$$;

revoke all on function public.pay_request_user_id() from public, anon, authenticated;
revoke all on function public.pay_has_merchant_access(uuid, text[]) from public, anon, authenticated;
revoke all on function public.pay_has_affiliate_access(uuid) from public, anon, authenticated;
grant execute on function public.pay_request_user_id() to authenticated;
grant execute on function public.pay_has_merchant_access(uuid, text[]) to authenticated;
grant execute on function public.pay_has_affiliate_access(uuid) to authenticated;

revoke all on table public.pay_merchants, public.pay_merchant_members, public.pay_merchant_wallets,
  public.pay_payment_intents, public.pay_payment_transactions, public.pay_payment_transfers,
  public.pay_payment_events, public.pay_payment_links, public.pay_invoices,
  public.pay_merchant_ledger, public.pay_referrals, public.pay_affiliates,
  public.pay_commissions, public.pay_gas_accounts, public.pay_gas_ledger
from anon, authenticated;

grant select on table public.pay_merchants, public.pay_merchant_members, public.pay_merchant_wallets,
  public.pay_payment_intents, public.pay_payment_transactions, public.pay_payment_transfers,
  public.pay_payment_events, public.pay_payment_links, public.pay_invoices,
  public.pay_merchant_ledger, public.pay_referrals, public.pay_affiliates,
  public.pay_commissions, public.pay_gas_accounts, public.pay_gas_ledger to authenticated;

-- Merchant tenant boundary.
drop policy if exists pay_merchants_select_member on public.pay_merchants;
create policy pay_merchants_select_member on public.pay_merchants
for select to authenticated
using (public.pay_has_merchant_access(id));

drop policy if exists pay_merchant_members_select_member on public.pay_merchant_members;
create policy pay_merchant_members_select_member on public.pay_merchant_members
for select to authenticated
using (public.pay_has_merchant_access(merchant_id));

drop policy if exists pay_merchant_wallets_select_member on public.pay_merchant_wallets;
create policy pay_merchant_wallets_select_member on public.pay_merchant_wallets
for select to authenticated
using (public.pay_has_merchant_access(merchant_id));

drop policy if exists pay_payment_intents_select_member on public.pay_payment_intents;
create policy pay_payment_intents_select_member on public.pay_payment_intents
for select to authenticated
using (public.pay_has_merchant_access(merchant_id));

drop policy if exists pay_payment_transactions_select_member on public.pay_payment_transactions;
create policy pay_payment_transactions_select_member on public.pay_payment_transactions
for select to authenticated
using (
  exists (
    select 1 from public.pay_payment_intents p
     where p.id = payment_id
       and public.pay_has_merchant_access(p.merchant_id)
  )
);

drop policy if exists pay_payment_transfers_select_member on public.pay_payment_transfers;
create policy pay_payment_transfers_select_member on public.pay_payment_transfers
for select to authenticated
using (
  exists (
    select 1
      from public.pay_payment_transactions t
      join public.pay_payment_intents p on p.id = t.payment_id
     where t.id = payment_transaction_id
       and public.pay_has_merchant_access(p.merchant_id)
  )
);

drop policy if exists pay_payment_events_select_member on public.pay_payment_events;
create policy pay_payment_events_select_member on public.pay_payment_events
for select to authenticated
using (
  exists (
    select 1 from public.pay_payment_intents p
     where p.id = payment_id
       and public.pay_has_merchant_access(p.merchant_id)
  )
);

drop policy if exists pay_payment_links_select_member on public.pay_payment_links;
create policy pay_payment_links_select_member on public.pay_payment_links
for select to authenticated
using (public.pay_has_merchant_access(merchant_id));

drop policy if exists pay_invoices_select_member on public.pay_invoices;
create policy pay_invoices_select_member on public.pay_invoices
for select to authenticated
using (public.pay_has_merchant_access(merchant_id));

drop policy if exists pay_merchant_ledger_select_member on public.pay_merchant_ledger;
create policy pay_merchant_ledger_select_member on public.pay_merchant_ledger
for select to authenticated
using (public.pay_has_merchant_access(merchant_id));

drop policy if exists pay_gas_accounts_select_member on public.pay_gas_accounts;
create policy pay_gas_accounts_select_member on public.pay_gas_accounts
for select to authenticated
using (public.pay_has_merchant_access(merchant_id));

drop policy if exists pay_gas_ledger_select_member on public.pay_gas_ledger;
create policy pay_gas_ledger_select_member on public.pay_gas_ledger
for select to authenticated
using (
  exists (
    select 1 from public.pay_gas_accounts g
     where g.id = gas_account_id
       and public.pay_has_merchant_access(g.merchant_id)
  )
);

-- Referral/affiliate isolation.
drop policy if exists pay_affiliates_select_owner on public.pay_affiliates;
create policy pay_affiliates_select_owner on public.pay_affiliates
for select to authenticated
using (public.pay_has_affiliate_access(id));

drop policy if exists pay_referrals_select_participant on public.pay_referrals;
create policy pay_referrals_select_participant on public.pay_referrals
for select to authenticated
using (
  public.pay_has_merchant_access(merchant_id)
  or public.pay_has_affiliate_access(affiliate_id)
);

drop policy if exists pay_commissions_select_participant on public.pay_commissions;
create policy pay_commissions_select_participant on public.pay_commissions
for select to authenticated
using (
  exists (
    select 1
      from public.pay_referrals r
     where r.id = referral_id
       and (public.pay_has_merchant_access(r.merchant_id) or public.pay_has_affiliate_access(r.affiliate_id))
  )
);

-- Secrets, API keys, idempotency internals, revenue recognition, webhook payloads,
-- and audit logs remain server-mediated until a column-safe read contract exists.
