-- Defense-in-depth: API validation is not the database contract.
-- Payment Intents cannot be created with an already-expired deadline.

create or replace function public.pay_guard_payment_intent_expiry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.expires_at <= now() then
    raise exception 'payment intent expiry must be in the future';
  end if;
  return new;
end;
$$;

revoke all on function public.pay_guard_payment_intent_expiry() from public, anon, authenticated;

drop trigger if exists pay_payment_intent_expiry_guard on public.pay_payment_intents;
create trigger pay_payment_intent_expiry_guard
before insert on public.pay_payment_intents
for each row execute function public.pay_guard_payment_intent_expiry();

comment on function public.pay_guard_payment_intent_expiry() is
  'Rejects creation of Payment Intents whose expiry is not strictly in the future.';
