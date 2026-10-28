-- Isolated adversarial contract test for Payment Link upgrade stages 2 and 3.
-- Exercises the real source migrations and a stubbed core intent creator; never uses Production.

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
END;
$roles$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE public.users (
  id text PRIMARY KEY,
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.pay_merchants (
  id uuid PRIMARY KEY,
  status text NOT NULL
);
CREATE TABLE public.pay_merchant_members (
  user_id text NOT NULL,
  merchant_id uuid NOT NULL,
  status text NOT NULL,
  role text NOT NULL
);
CREATE TABLE public.pay_payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  fixed_amount_atomic numeric(78,0) NOT NULL,
  asset text NOT NULL,
  fee_payer text NOT NULL,
  checkout_locale text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pay_payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  payment_link_id uuid REFERENCES public.pay_payment_links(id) ON DELETE RESTRICT,
  amount_atomic numeric(78,0) NOT NULL,
  asset text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  expires_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_first_name text,
  customer_last_name text,
  customer_purpose text
);
CREATE TABLE public.pay_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  scope text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL,
  response_status integer,
  response_body jsonb,
  resource_type text,
  resource_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (merchant_id,scope,idempotency_key)
);

GRANT ALL ON public.users, public.pay_merchants, public.pay_merchant_members,
  public.pay_payment_links, public.pay_payment_intents, public.pay_idempotency_keys
  TO service_role;

CREATE OR REPLACE FUNCTION public.pay_request_user_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $request_user$
  SELECT nullif((current_setting('request.jwt.claims',true)::jsonb->>'solmint_user_id'),'');
$request_user$;

CREATE OR REPLACE FUNCTION public.pay_has_merchant_access(p_merchant_id uuid,p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $merchant_access$
  SELECT EXISTS (
    SELECT 1 FROM public.pay_merchant_members mm
    WHERE mm.merchant_id=p_merchant_id
      AND mm.user_id=public.pay_request_user_id()
      AND mm.status='active'
      AND mm.role=ANY(p_roles)
  );
$merchant_access$;

-- A disposable implementation of the existing core creator for exercising the Link wrapper.
CREATE OR REPLACE FUNCTION public.pay_create_payment_intent(
  p_merchant_id uuid,
  p_customer_id uuid,
  p_amount_atomic numeric,
  p_asset text,
  p_token_mint text,
  p_token_program text,
  p_token_decimals integer,
  p_recipient text,
  p_reference text,
  p_fee_bps integer,
  p_fee_payer text,
  p_fee_atomic numeric,
  p_customer_total_atomic numeric,
  p_merchant_net_atomic numeric,
  p_fee_recipient text,
  p_network text,
  p_expires_at timestamptz,
  p_metadata jsonb,
  p_idempotency_key text,
  p_request_hash text,
  p_scope text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $core_creator$
DECLARE
  v_existing public.pay_idempotency_keys%rowtype;
  v_id uuid;
  v_response jsonb;
BEGIN
  INSERT INTO public.pay_idempotency_keys(merchant_id,scope,idempotency_key,request_hash,status)
  VALUES(p_merchant_id,p_scope,trim(p_idempotency_key),trim(p_request_hash),'processing')
  ON CONFLICT (merchant_id,scope,idempotency_key) DO NOTHING
  RETURNING * INTO v_existing;

  IF NOT FOUND THEN
    SELECT * INTO v_existing FROM public.pay_idempotency_keys
    WHERE merchant_id=p_merchant_id AND scope=p_scope AND idempotency_key=trim(p_idempotency_key)
    FOR UPDATE;
    IF v_existing.request_hash <> trim(p_request_hash) THEN RETURN jsonb_build_object('state','conflict'); END IF;
    IF v_existing.status='completed' AND v_existing.response_body IS NOT NULL THEN
      RETURN jsonb_build_object('state','replay','response_body',v_existing.response_body,'response_status',coalesce(v_existing.response_status,200),'resource_id',v_existing.resource_id);
    END IF;
    IF v_existing.status='processing' THEN RETURN jsonb_build_object('state','in_progress'); END IF;
    RETURN jsonb_build_object('state','error');
  END IF;

  INSERT INTO public.pay_payment_intents(merchant_id,amount_atomic,asset,status,expires_at,metadata)
  VALUES(p_merchant_id,p_amount_atomic,p_asset,'created',p_expires_at,coalesce(p_metadata,'{}'::jsonb))
  RETURNING id INTO v_id;

  v_response := jsonb_build_object(
    'apiVersion','v1',
    'data',jsonb_build_object('id',v_id)
  );

  UPDATE public.pay_idempotency_keys
     SET status='completed',response_status=201,response_body=v_response,
         resource_type='payment_intent',resource_id=v_id,completed_at=now()
   WHERE merchant_id=p_merchant_id AND scope=p_scope
     AND idempotency_key=trim(p_idempotency_key) AND status='processing';
  IF NOT FOUND THEN RAISE EXCEPTION 'core Payment Intent idempotency completion failed'; END IF;

  RETURN jsonb_build_object('state','created','response_status',201,'response_body',v_response,'resource_id',v_id);
END;
$core_creator$;

\i supabase/migrations/20260927134700_solmint_pay_payment_link_end_to_end.sql
\i supabase/migrations/20260927150000_solmint_pay_payment_link_mutations.sql
\i supabase/migrations/20260930073558_solmint_pay_public_payer_identity_20260930100000.sql
\i supabase/migrations/20261028101500_solmint_pay_payment_link_upgrade_stages_2_3.sql

INSERT INTO public.users(id,is_active) VALUES ('upgrade-owner',true);
INSERT INTO public.pay_merchants(id,status) VALUES ('00000000-0000-0000-0000-000000000001','active');
INSERT INTO public.pay_merchant_members(user_id,merchant_id,status,role)
VALUES ('upgrade-owner','00000000-0000-0000-0000-000000000001','active','owner');

DO $privileges$
BEGIN
  IF has_function_privilege('anon',
    'public.pay_create_payment_link(uuid,text,text,text,numeric,text,text,text,timestamptz,text,text,text,integer,jsonb)',
    'EXECUTE') THEN RAISE EXCEPTION 'anon can create configured Payment Links'; END IF;
  IF has_function_privilege('authenticated',
    'public.pay_create_payment_link(uuid,text,text,text,numeric,text,text,text,timestamptz,text,text,text,integer,jsonb)',
    'EXECUTE') IS NOT TRUE THEN RAISE EXCEPTION 'authenticated cannot create configured Payment Links'; END IF;
  IF has_function_privilege('anon',
    'public.pay_update_payment_link(uuid,uuid,text,text,text,numeric,text,text,text,boolean,timestamptz,text,text,text,integer,jsonb)',
    'EXECUTE') THEN RAISE EXCEPTION 'anon can update configured Payment Links'; END IF;
  IF has_function_privilege('service_role',
    'public.pay_create_payment_intent_from_link(uuid,uuid,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text,text,text,text,jsonb)',
    'EXECUTE') IS NOT TRUE THEN RAISE EXCEPTION 'service_role cannot create configured Payment Intents'; END IF;
  IF has_function_privilege('anon',
    'public.pay_create_payment_intent_from_link(uuid,uuid,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text,text,text,text,jsonb)',
    'EXECUTE') THEN RAISE EXCEPTION 'anon can create Payment Intents from Payment Links'; END IF;
  IF has_function_privilege('service_role',
    'public.pay_create_payment_intent_from_link(uuid,uuid,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text)',
    'EXECUTE') THEN RAISE EXCEPTION 'legacy creator without payer/capacity contract is still executable'; END IF;
END;
$privileges$;

-- Create one capped Link with required Order ID and optional email.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"solmint_user_id":"upgrade-owner"}',true);
DO $create_link$
DECLARE
  v jsonb;
  v_replay jsonb;
  v_fields jsonb := '[
    {"key":"order_id","label":"Order ID","type":"text","required":true},
    {"key":"email","label":"Receipt email","type":"email","required":false}
  ]'::jsonb;
BEGIN
  v := public.pay_create_payment_link(
    '00000000-0000-0000-0000-000000000001',
    'upgrade-link','Upgrade test','test description',1000000,'USDC','merchant','en-US',
    NULL,'create-upgrade-1',repeat('a',64),'https://merchant.example/paid',1,v_fields
  );
  IF v->>'state' <> 'created' THEN RAISE EXCEPTION 'configured link create failed: %',v; END IF;
  IF v->'response_body'->'data'->>'success_url' <> 'https://merchant.example/paid'
     OR v->'response_body'->'data'->>'max_payments' <> '1'
     OR v->'response_body'->'data'->'checkout_fields' <> v_fields THEN
    RAISE EXCEPTION 'configured link settings missing from create response: %',v;
  END IF;
  v_replay := public.pay_create_payment_link(
    '00000000-0000-0000-0000-000000000001',
    'upgrade-link','Upgrade test','test description',1000000,'USDC','merchant','en-US',
    NULL,'create-upgrade-1',repeat('a',64),'https://merchant.example/paid',1,v_fields
  );
  IF v_replay->>'state' <> 'replay'
     OR v_replay->'response_body'->'data'->>'success_url' <> 'https://merchant.example/paid' THEN
    RAISE EXCEPTION 'configured link replay lost extension settings: %',v_replay;
  END IF;
END;
$create_link$;
COMMIT;

-- The first Payment Intent reserves one slot and snapshots redirect/field schema and values.
BEGIN;
SET LOCAL ROLE service_role;
DO $first_intent$
DECLARE
  v jsonb;
  v_link_id uuid;
  v_id uuid;
  v_values jsonb := '{"order_id":"ORDER-001","email":"customer@example.com"}'::jsonb;
BEGIN
  SELECT id INTO v_link_id FROM public.pay_payment_links WHERE slug='upgrade-link';
  v := public.pay_create_payment_intent_from_link(
    v_link_id,
    '00000000-0000-0000-0000-000000000001'::uuid,
    1000000,'USDC',NULL,NULL,NULL,'recipient','reference-1',100,'merchant',
    10000,1000000,990000,'fee-recipient','solana',now()+interval '10 minutes',
    '{}'::jsonb,'intent-upgrade-1',repeat('b',64),'payment-intents:link',
    'Ali','Ahmadi','Order',v_values
  );
  IF v->>'state' <> 'created' THEN RAISE EXCEPTION 'first intent create failed: %',v; END IF;
  v_id := (v->>'resource_id')::uuid;

  IF (SELECT payment_link_success_url FROM public.pay_payment_intents WHERE id=v_id) <> 'https://merchant.example/paid' THEN
    RAISE EXCEPTION 'success redirect was not snapshotted to the Payment Intent';
  END IF;
  IF (SELECT payment_link_checkout_fields FROM public.pay_payment_intents WHERE id=v_id)
     <> '[{"key":"order_id","label":"Order ID","type":"text","required":true},{"key":"email","label":"Receipt email","type":"email","required":false}]'::jsonb THEN
    RAISE EXCEPTION 'field definition snapshot mismatch';
  END IF;
  IF (SELECT customer_custom_fields FROM public.pay_payment_intents WHERE id=v_id) <> v_values THEN
    RAISE EXCEPTION 'customer custom field values were not persisted exactly';
  END IF;
END;
$first_intent$;
COMMIT;


-- After an update, existing Payment Intents retain their snapshots; new intents must
-- satisfy the new field schema, and the locked capacity counts active reservations.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"solmint_user_id":"upgrade-owner"}',true);
DO $update_link$
DECLARE
  v_link_id uuid;
  v_result jsonb;
  v_new_fields jsonb := '[{"key":"purchase_ref","label":"Purchase reference","type":"text","required":true}]'::jsonb;
BEGIN
  SELECT id INTO v_link_id FROM public.pay_payment_links WHERE slug='upgrade-link';
  v_result := public.pay_update_payment_link(
    v_link_id,'00000000-0000-0000-0000-000000000001',
    'upgrade-link','Upgrade test revised','new description',1000000,'USDC','merchant','en-US',
    true,NULL,'update-upgrade-1',repeat('c',64),
    'https://merchant.example/paid-v2',2,v_new_fields
  );
  IF v_result->>'state' <> 'updated' THEN RAISE EXCEPTION 'configured link update failed: %',v_result; END IF;
  IF v_result->'response_body'->'data'->>'success_url' <> 'https://merchant.example/paid-v2'
     OR v_result->'response_body'->'data'->>'max_payments' <> '2'
     OR v_result->'response_body'->'data'->'checkout_fields' <> v_new_fields THEN
    RAISE EXCEPTION 'configured update settings missing from response: %',v_result;
  END IF;
END;
$update_link$;
COMMIT;

DO $immutable_snapshot$
BEGIN
  IF (SELECT payment_link_success_url FROM public.pay_payment_intents WHERE customer_custom_fields->>'order_id'='ORDER-001' LIMIT 1) <> 'https://merchant.example/paid' THEN
    RAISE EXCEPTION 'changing the Payment Link mutated a historical success redirect snapshot';
  END IF;
  IF (SELECT payment_link_checkout_fields FROM public.pay_payment_intents WHERE customer_custom_fields->>'order_id'='ORDER-001' LIMIT 1)
     <> '[{"key":"order_id","label":"Order ID","type":"text","required":true},{"key":"email","label":"Receipt email","type":"email","required":false}]'::jsonb THEN
    RAISE EXCEPTION 'changing the Payment Link mutated historical field definitions';
  END IF;
  IF (SELECT customer_custom_fields FROM public.pay_payment_intents WHERE customer_custom_fields->>'order_id'='ORDER-001' LIMIT 1)
     <> '{"order_id":"ORDER-001","email":"customer@example.com"}'::jsonb THEN
    RAISE EXCEPTION 'historical custom field values changed';
  END IF;
END;
$immutable_snapshot$;

-- New field schema is checked server-side, not just in the browser.
BEGIN;
SET LOCAL ROLE service_role;
DO $new_field_intents$
DECLARE
  v_link_id uuid;
  v_result jsonb;
  v_second_id uuid;
  v_replay jsonb;
  v_blocked jsonb;
BEGIN
  SELECT id INTO v_link_id FROM public.pay_payment_links WHERE slug='upgrade-link';

  v_result := public.pay_create_payment_intent_from_link(
    v_link_id,'00000000-0000-0000-0000-000000000001',1000000,'USDC',NULL,NULL,NULL,
    'recipient','reference-missing',100,'merchant',10000,1000000,990000,'fee-recipient',
    'solana',now()+interval '10 minutes','{}'::jsonb,'intent-missing-field',repeat('d',64),
    'payment-intents:link','Ali','Ahmadi','Order','{}'::jsonb
  );
  IF v_result->>'state' <> 'invalid_custom_fields' THEN
    RAISE EXCEPTION 'missing required custom field was not rejected: %',v_result;
  END IF;

  v_result := public.pay_create_payment_intent_from_link(
    v_link_id,'00000000-0000-0000-0000-000000000001',1000000,'USDC',NULL,NULL,NULL,
    'recipient','reference-2',100,'merchant',10000,1000000,990000,'fee-recipient',
    'solana',now()+interval '10 minutes','{}'::jsonb,'intent-upgrade-2',repeat('e',64),
    'payment-intents:link','Ali','Ahmadi','Order','{"purchase_ref":"PO-002"}'::jsonb
  );
  IF v_result->>'state' <> 'created' THEN RAISE EXCEPTION 'second capped intent failed: %',v_result; END IF;
  v_second_id := (v_result->>'resource_id')::uuid;

  v_replay := public.pay_create_payment_intent_from_link(
    v_link_id,'00000000-0000-0000-0000-000000000001',1000000,'USDC',NULL,NULL,NULL,
    'recipient','reference-2',100,'merchant',10000,1000000,990000,'fee-recipient',
    'solana',now()+interval '10 minutes','{}'::jsonb,'intent-upgrade-2',repeat('e',64),
    'payment-intents:link','Ali','Ahmadi','Order','{"purchase_ref":"PO-002"}'::jsonb
  );
  IF v_replay->>'state' <> 'replay' OR (SELECT count(*) FROM public.pay_payment_intents WHERE payment_link_id=v_link_id) <> 2 THEN
    RAISE EXCEPTION 'idempotent replay was blocked by capacity or created a duplicate: %',v_replay;
  END IF;

  v_blocked := public.pay_create_payment_intent_from_link(
    v_link_id,'00000000-0000-0000-0000-000000000001',1000000,'USDC',NULL,NULL,NULL,
    'recipient','reference-3',100,'merchant',10000,1000000,990000,'fee-recipient',
    'solana',now()+interval '10 minutes','{}'::jsonb,'intent-upgrade-3',repeat('f',64),
    'payment-intents:link','Ali','Ahmadi','Order','{"purchase_ref":"PO-003"}'::jsonb
  );
  IF v_blocked->>'state' <> 'capacity_reached' THEN
    RAISE EXCEPTION 'payment capacity was not enforced after two active intents: %',v_blocked;
  END IF;

  -- Expired/failed reservations do not permanently consume a slot.
  UPDATE public.pay_payment_intents SET status='expired',expires_at=now()-interval '1 second'
   WHERE id=(SELECT id FROM public.pay_payment_intents WHERE payment_link_id=v_link_id AND id<>v_second_id ORDER BY id LIMIT 1);
  v_result := public.pay_create_payment_intent_from_link(
    v_link_id,'00000000-0000-0000-0000-000000000001',1000000,'USDC',NULL,NULL,NULL,
    'recipient','reference-4',100,'merchant',10000,1000000,990000,'fee-recipient',
    'solana',now()+interval '10 minutes','{}'::jsonb,'intent-upgrade-4',repeat('1',64),
    'payment-intents:link','Ali','Ahmadi','Order','{"purchase_ref":"PO-004"}'::jsonb
  );
  IF v_result->>'state' <> 'created' THEN RAISE EXCEPTION 'expired reservation did not release capacity: %',v_result; END IF;
END;
$new_field_intents$;
COMMIT;

DO $constraints$
BEGIN
  IF public.pay_validate_payment_link_checkout_fields('[{"key":"dup","label":"One","type":"text","required":false},{"key":"dup","label":"Two","type":"text","required":false}]'::jsonb) THEN
    RAISE EXCEPTION 'duplicate Checkout field keys were accepted';
  END IF;
  IF public.pay_validate_payment_link_checkout_fields('[{"key":"bad-key","label":"Bad","type":"text","required":false}]'::jsonb) THEN
    RAISE EXCEPTION 'invalid Checkout field key was accepted';
  END IF;
  IF public.pay_validate_payment_link_checkout_fields(('[{"key":"f1","label":"1","type":"text","required":false},{"key":"f2","label":"2","type":"text","required":false},{"key":"f3","label":"3","type":"text","required":false},{"key":"f4","label":"4","type":"text","required":false},{"key":"f5","label":"5","type":"text","required":false},{"key":"f6","label":"6","type":"text","required":false}]')::jsonb) THEN
    RAISE EXCEPTION 'more than five Checkout fields were accepted';
  END IF;
  IF has_function_privilege('authenticated',
    'public.pay_create_payment_intent_from_link(uuid,uuid,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text,text,text,text,jsonb)',
    'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can invoke the service-role-only Payment Intent creator';
  END IF;
END;
$constraints$;

SELECT 'pay_payment_link_upgrade_security_ok' AS result;
