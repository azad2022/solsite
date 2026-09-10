-- SolMint Pay RLS adversarial validation.
-- This script is intentionally ephemeral: all fixtures are rolled back.
-- Run only against a controlled database connection with administrative test access.

begin;

insert into public.users(id, username, full_name, password_hash, role, is_active)
values
  ('usr-pay-rls-a','pay_rls_test_a','Pay RLS Test A','test-only-placeholder-hash','admin',true),
  ('usr-pay-rls-b','pay_rls_test_b','Pay RLS Test B','test-only-placeholder-hash','admin',true),
  ('usr-pay-rls-c','pay_rls_test_c','Pay RLS Test C','test-only-placeholder-hash','user',true);

insert into public.pay_merchants(id, owner_user_id, business_name, slug, status)
values
  ('00000000-0000-4000-8000-0000000000a1','usr-pay-rls-a','RLS Test A','rls-test-a','active'),
  ('00000000-0000-4000-8000-0000000000b1','usr-pay-rls-b','RLS Test B','rls-test-b','active');

insert into public.pay_merchant_members(merchant_id,user_id,role,status)
values
  ('00000000-0000-4000-8000-0000000000a1','usr-pay-rls-a','owner','active'),
  ('00000000-0000-4000-8000-0000000000b1','usr-pay-rls-b','owner','active'),
  ('00000000-0000-4000-8000-0000000000a1','usr-pay-rls-c','viewer','active');

insert into public.pay_payment_intents(
  id, merchant_id, amount_atomic, asset, recipient, reference, fee_bps,
  fee_payer, fee_atomic, status, expires_at, customer_total_atomic,
  merchant_net_atomic, fee_recipient, network, merchant_settlement_atomic
)
values
  ('00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000a1',1000000,'SOL',
   '11111111111111111111111111111111','111111111111111111111111111111111111111111',100,'merchant',10000,
   'created',now()+interval '15 minutes',1000000,990000,'22222222222222222222222222222222','solana',990000),
  ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000b1',2000000,'SOL',
   '33333333333333333333333333333333','222222222222222222222222222222222222222222',100,'merchant',20000,
   'created',now()+interval '15 minutes',2000000,1980000,'44444444444444444444444444444444','solana',1980000);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('solmint_user_id','usr-pay-rls-a')::text, true);

do $$
begin
  if (select array_agg(slug order by slug) from public.pay_merchants) <> array['rls-test-a'] then raise exception 'RLS_FAIL owner merchant isolation'; end if;
  if (select array_agg(id::text order by id) from public.pay_payment_intents) <> array['00000000-0000-4000-8000-0000000000c1'] then raise exception 'RLS_FAIL owner payment isolation'; end if;
  if public.pay_has_merchant_access('00000000-0000-4000-8000-0000000000b1'::uuid) then raise exception 'RLS_FAIL cross-merchant access'; end if;
  if not public.pay_has_merchant_access('00000000-0000-4000-8000-0000000000a1'::uuid, array['owner']::text[]) then raise exception 'RLS_FAIL owner role access'; end if;
  if public.pay_has_merchant_access('00000000-0000-4000-8000-0000000000a1'::uuid, array['finance']::text[]) then raise exception 'RLS_FAIL unauthorized finance role'; end if;
  if has_table_privilege('authenticated','public.pay_payment_intents','insert') then raise exception 'RLS_FAIL authenticated insert grant'; end if;
  if has_table_privilege('authenticated','public.pay_payment_intents','update') then raise exception 'RLS_FAIL authenticated update grant'; end if;
  if has_table_privilege('authenticated','public.pay_api_keys','select') then raise exception 'RLS_FAIL authenticated api-key visibility'; end if;
end $$;

select set_config('request.jwt.claims', json_build_object('solmint_user_id','usr-pay-rls-c')::text, true);
do $$
begin
  if (select array_agg(slug order by slug) from public.pay_merchants) <> array['rls-test-a'] then raise exception 'RLS_FAIL viewer merchant isolation'; end if;
  if not public.pay_has_merchant_access('00000000-0000-4000-8000-0000000000a1'::uuid) then raise exception 'RLS_FAIL viewer tenant access'; end if;
  if public.pay_has_merchant_access('00000000-0000-4000-8000-0000000000a1'::uuid, array['finance']::text[]) then raise exception 'RLS_FAIL viewer finance access'; end if;
end $$;

select set_config('request.jwt.claims', json_build_object('solmint_user_id','usr-does-not-exist')::text, true);
do $$
begin
  if public.pay_has_merchant_access('00000000-0000-4000-8000-0000000000a1'::uuid) then raise exception 'RLS_FAIL unknown user access'; end if;
end $$;

rollback;
