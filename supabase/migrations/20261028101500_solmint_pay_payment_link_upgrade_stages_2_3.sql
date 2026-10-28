-- SolMint Pay Payment Link upgrade: authoritative success redirect, capacity, and custom Checkout fields.
-- Existing links are unlimited by default and have no custom fields/redirect unless configured.
-- Capacity is enforced under a row lock by the Payment Intent creation RPC, not by UI state.

CREATE OR REPLACE FUNCTION public.pay_validate_payment_link_checkout_fields(p_fields jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $pay_link_fields_valid$
DECLARE
  v_field jsonb;
  v_key text;
  v_label text;
  v_type text;
  v_keys text[] := ARRAY[]::text[];
BEGIN
  IF p_fields IS NULL OR jsonb_typeof(p_fields) <> 'array' OR jsonb_array_length(p_fields) > 5 THEN
    RETURN false;
  END IF;

  FOR v_field IN SELECT value FROM jsonb_array_elements(p_fields) AS fields(value) LOOP
    IF jsonb_typeof(v_field) <> 'object'
       OR (SELECT count(*) FROM jsonb_object_keys(v_field)) <> 4
       OR NOT (v_field ?& ARRAY['key','label','type','required'])
       OR jsonb_typeof(v_field->'key') <> 'string'
       OR jsonb_typeof(v_field->'label') <> 'string'
       OR jsonb_typeof(v_field->'type') <> 'string'
       OR jsonb_typeof(v_field->'required') <> 'boolean' THEN
      RETURN false;
    END IF;

    v_key := v_field->>'key';
    v_label := btrim(v_field->>'label');
    v_type := v_field->>'type';

    IF v_key !~ '^[a-z][a-z0-9_]{0,31}$'
       OR v_key = ANY(v_keys)
       OR char_length(v_label) < 1
       OR char_length(v_label) > 80
       OR v_label ~ '[[:cntrl:]]'
       OR v_type NOT IN ('text','email','textarea') THEN
      RETURN false;
    END IF;

    v_keys := array_append(v_keys, v_key);
  END LOOP;

  RETURN true;
EXCEPTION WHEN others THEN
  RETURN false;
END;
$pay_link_fields_valid$;

CREATE OR REPLACE FUNCTION public.pay_normalize_payment_link_checkout_field_values(
  p_fields jsonb,
  p_values jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $pay_link_field_values$
DECLARE
  v_field jsonb;
  v_key text;
  v_type text;
  v_raw text;
  v_value text;
  v_max_length integer;
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.pay_validate_payment_link_checkout_fields(p_fields)
     OR p_values IS NULL
     OR jsonb_typeof(p_values) <> 'object' THEN
    RAISE EXCEPTION 'invalid Payment Link custom Checkout field schema or values';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_values) LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_fields) AS f(value)
      WHERE f.value->>'key' = v_key
    ) THEN
      RAISE EXCEPTION 'unknown Payment Link custom Checkout field';
    END IF;
  END LOOP;

  FOR v_field IN SELECT value FROM jsonb_array_elements(p_fields) AS fields(value) LOOP
    v_key := v_field->>'key';
    v_type := v_field->>'type';

    IF NOT (p_values ? v_key) THEN
      IF (v_field->>'required')::boolean THEN
        RAISE EXCEPTION 'required Payment Link custom Checkout field is missing';
      END IF;
      CONTINUE;
    END IF;

    IF jsonb_typeof(p_values->v_key) <> 'string' THEN
      RAISE EXCEPTION 'Payment Link custom Checkout field value must be a string';
    END IF;

    v_raw := p_values->>v_key;
    v_value := regexp_replace(regexp_replace(btrim(v_raw), '[[:cntrl:]]', ' ', 'g'), '[[:space:]]+', ' ', 'g');

    IF v_value = '' THEN
      IF (v_field->>'required')::boolean THEN
        RAISE EXCEPTION 'required Payment Link custom Checkout field is empty';
      END IF;
      CONTINUE;
    END IF;

    v_max_length := CASE v_type WHEN 'email' THEN 254 WHEN 'textarea' THEN 2000 ELSE 500 END;
    IF char_length(v_value) > v_max_length THEN
      RAISE EXCEPTION 'Payment Link custom Checkout field value is too long';
    END IF;

    IF v_type = 'email' AND v_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      RAISE EXCEPTION 'Payment Link custom Checkout email is invalid';
    END IF;

    v_result := v_result || jsonb_build_object(v_key, v_value);
  END LOOP;

  RETURN v_result;
END;
$pay_link_field_values$;

REVOKE ALL ON FUNCTION public.pay_validate_payment_link_checkout_fields(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pay_normalize_payment_link_checkout_field_values(jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_validate_payment_link_checkout_fields(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_normalize_payment_link_checkout_field_values(jsonb,jsonb) TO authenticated, service_role;

ALTER TABLE public.pay_payment_links
  ADD COLUMN IF NOT EXISTS success_url text,
  ADD COLUMN IF NOT EXISTS max_payments integer,
  ADD COLUMN IF NOT EXISTS checkout_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.pay_payment_intents
  ADD COLUMN IF NOT EXISTS payment_link_success_url text,
  ADD COLUMN IF NOT EXISTS payment_link_checkout_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.pay_payment_links
  DROP CONSTRAINT IF EXISTS pay_payment_links_max_payments_check,
  DROP CONSTRAINT IF EXISTS pay_payment_links_success_url_check,
  DROP CONSTRAINT IF EXISTS pay_payment_links_checkout_fields_check;

ALTER TABLE public.pay_payment_links
  ADD CONSTRAINT pay_payment_links_max_payments_check
    CHECK (max_payments IS NULL OR max_payments > 0),
  ADD CONSTRAINT pay_payment_links_success_url_check
    CHECK (
      success_url IS NULL
      OR (
        char_length(success_url) BETWEEN 1 AND 2048
        AND success_url ~ '^https://[^/?#]+'
        AND success_url !~ '[[:space:][:cntrl:]]'
        AND success_url !~ '^https://[^/?#]*@'
      )
    ),
  ADD CONSTRAINT pay_payment_links_checkout_fields_check
    CHECK (public.pay_validate_payment_link_checkout_fields(checkout_fields));

ALTER TABLE public.pay_payment_intents
  DROP CONSTRAINT IF EXISTS pay_payment_intents_link_success_url_check,
  DROP CONSTRAINT IF EXISTS pay_payment_intents_link_checkout_fields_check,
  DROP CONSTRAINT IF EXISTS pay_payment_intents_custom_fields_object_check,
  DROP CONSTRAINT IF EXISTS pay_payment_intents_custom_fields_match_definition_check;

ALTER TABLE public.pay_payment_intents
  ADD CONSTRAINT pay_payment_intents_link_success_url_check
    CHECK (
      payment_link_success_url IS NULL
      OR (
        char_length(payment_link_success_url) BETWEEN 1 AND 2048
        AND payment_link_success_url ~ '^https://[^/?#]+'
        AND payment_link_success_url !~ '[[:space:][:cntrl:]]'
        AND payment_link_success_url !~ '^https://[^/?#]*@'
      )
    ),
  ADD CONSTRAINT pay_payment_intents_link_checkout_fields_check
    CHECK (public.pay_validate_payment_link_checkout_fields(payment_link_checkout_fields)),
  ADD CONSTRAINT pay_payment_intents_custom_fields_object_check
    CHECK (jsonb_typeof(customer_custom_fields) = 'object'),
  ADD CONSTRAINT pay_payment_intents_custom_fields_match_definition_check
    CHECK (
      public.pay_normalize_payment_link_checkout_field_values(
        payment_link_checkout_fields,
        customer_custom_fields
      ) = customer_custom_fields
    );

COMMENT ON COLUMN public.pay_payment_links.success_url IS
  'Optional merchant HTTPS redirect destination. Snapshotted to the Payment Intent; browsers may use it only after authoritative completed status.';
COMMENT ON COLUMN public.pay_payment_links.max_payments IS
  'Optional maximum simultaneous active reservations plus completed payments. NULL means unlimited; enforced under a Payment Link row lock.';
COMMENT ON COLUMN public.pay_payment_links.checkout_fields IS
  'Allowlisted public Checkout field definitions. Values are validated and snapshotted on the Payment Intent.';
COMMENT ON COLUMN public.pay_payment_intents.payment_link_success_url IS
  'Immutable success redirect snapshot copied from the associated Payment Link at intent creation.';
COMMENT ON COLUMN public.pay_payment_intents.payment_link_checkout_fields IS
  'Immutable custom Checkout field definitions copied from the associated Payment Link at intent creation.';
COMMENT ON COLUMN public.pay_payment_intents.customer_custom_fields IS
  'Validated custom Checkout values for merchant-side transaction detail; never returned by the public Payment Intent endpoint.';

-- Creation overload: delegate the existing RBAC/idempotency implementation, then set
-- the new settings and update the replay cache in the same transaction.
CREATE OR REPLACE FUNCTION public.pay_create_payment_link(
  p_merchant_id uuid,
  p_slug text,
  p_title text,
  p_description text,
  p_fixed_amount_atomic numeric,
  p_asset text,
  p_fee_payer text,
  p_checkout_locale text,
  p_expires_at timestamptz,
  p_idempotency_key text,
  p_request_hash text,
  p_success_url text,
  p_max_payments integer,
  p_checkout_fields jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $pay_create_link_settings$
DECLARE
  v_result jsonb;
  v_link public.pay_payment_links%rowtype;
  v_link_id uuid;
  v_response jsonb;
  v_idempotency_id uuid;
BEGIN
  IF (p_success_url IS NOT NULL AND (
        char_length(p_success_url) NOT BETWEEN 1 AND 2048
        OR p_success_url !~ '^https://[^/?#]+'
        OR p_success_url ~ '[[:space:][:cntrl:]]'
        OR p_success_url ~ '^https://[^/?#]*@'
      ))
     OR (p_max_payments IS NOT NULL AND p_max_payments < 1)
     OR NOT public.pay_validate_payment_link_checkout_fields(p_checkout_fields) THEN
    RETURN jsonb_build_object('state','invalid');
  END IF;

  v_result := public.pay_create_payment_link(
    p_merchant_id, p_slug, p_title, p_description, p_fixed_amount_atomic,
    p_asset, p_fee_payer, p_checkout_locale, p_expires_at,
    p_idempotency_key, p_request_hash
  );

  IF v_result->>'state' <> 'created' THEN
    RETURN v_result;
  END IF;

  v_link_id := nullif(v_result->>'resource_id','')::uuid;
  UPDATE public.pay_payment_links
     SET success_url = p_success_url,
         max_payments = p_max_payments,
         checkout_fields = p_checkout_fields
   WHERE id = v_link_id
     AND merchant_id = p_merchant_id
  RETURNING * INTO v_link;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment Link settings update failed after creation';
  END IF;

  v_response := coalesce(v_result->'response_body','{}'::jsonb)
    || jsonb_build_object(
      'data',
      coalesce(v_result->'response_body'->'data','{}'::jsonb)
      || jsonb_build_object(
        'success_url',v_link.success_url,
        'max_payments',v_link.max_payments,
        'checkout_fields',v_link.checkout_fields
      )
    );

  UPDATE public.pay_idempotency_keys
     SET response_body = v_response
   WHERE merchant_id = p_merchant_id
     AND scope = 'payment-links:create'
     AND idempotency_key = trim(p_idempotency_key)
     AND resource_id = v_link.id
     AND status = 'completed'
  RETURNING id INTO v_idempotency_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment Link creation replay snapshot update failed';
  END IF;

  RETURN jsonb_set(v_result, '{response_body}', v_response, true);
END;
$pay_create_link_settings$;

REVOKE ALL ON FUNCTION public.pay_create_payment_link(
  uuid,text,text,text,numeric,text,text,text,timestamptz,text,text,text,integer,jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_create_payment_link(
  uuid,text,text,text,numeric,text,text,text,timestamptz,text,text,text,integer,jsonb
) TO authenticated;

-- Update overload: retain existing tenant/RBAC/idempotency logic and extend the same
-- transaction with new settings; cached idempotent responses carry those settings too.
CREATE OR REPLACE FUNCTION public.pay_update_payment_link(
  p_payment_link_id uuid,
  p_merchant_id uuid,
  p_slug text,
  p_title text,
  p_description text,
  p_fixed_amount_atomic numeric,
  p_asset text,
  p_fee_payer text,
  p_checkout_locale text,
  p_is_active boolean,
  p_expires_at timestamptz,
  p_idempotency_key text,
  p_request_hash text,
  p_success_url text,
  p_max_payments integer,
  p_checkout_fields jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $pay_update_link_settings$
DECLARE
  v_result jsonb;
  v_link public.pay_payment_links%rowtype;
  v_link_id uuid;
  v_response jsonb;
  v_idempotency_id uuid;
BEGIN
  IF (p_success_url IS NOT NULL AND (
        char_length(p_success_url) NOT BETWEEN 1 AND 2048
        OR p_success_url !~ '^https://[^/?#]+'
        OR p_success_url ~ '[[:space:][:cntrl:]]'
        OR p_success_url ~ '^https://[^/?#]*@'
      ))
     OR (p_max_payments IS NOT NULL AND p_max_payments < 1)
     OR NOT public.pay_validate_payment_link_checkout_fields(p_checkout_fields) THEN
    RETURN jsonb_build_object('state','invalid');
  END IF;

  v_result := public.pay_update_payment_link(
    p_payment_link_id, p_merchant_id, p_slug, p_title, p_description,
    p_fixed_amount_atomic, p_asset, p_fee_payer, p_checkout_locale,
    p_is_active, p_expires_at, p_idempotency_key, p_request_hash
  );

  IF v_result->>'state' <> 'updated' THEN
    RETURN v_result;
  END IF;

  v_link_id := nullif(v_result->>'resource_id','')::uuid;
  UPDATE public.pay_payment_links
     SET success_url = p_success_url,
         max_payments = p_max_payments,
         checkout_fields = p_checkout_fields
   WHERE id = v_link_id
     AND merchant_id = p_merchant_id
  RETURNING * INTO v_link;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment Link settings update failed';
  END IF;

  v_response := coalesce(v_result->'response_body','{}'::jsonb)
    || jsonb_build_object(
      'data',
      coalesce(v_result->'response_body'->'data','{}'::jsonb)
      || jsonb_build_object(
        'success_url',v_link.success_url,
        'max_payments',v_link.max_payments,
        'checkout_fields',v_link.checkout_fields
      )
    );

  UPDATE public.pay_idempotency_keys
     SET response_body = v_response
   WHERE merchant_id = p_merchant_id
     AND scope = 'payment-links:update'
     AND idempotency_key = trim(p_idempotency_key)
     AND resource_id = v_link.id
     AND status = 'completed'
  RETURNING id INTO v_idempotency_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment Link update replay snapshot update failed';
  END IF;

  RETURN jsonb_set(v_result, '{response_body}', v_response, true);
END;
$pay_update_link_settings$;

REVOKE ALL ON FUNCTION public.pay_update_payment_link(
  uuid,uuid,text,text,text,numeric,text,text,text,boolean,timestamptz,text,text,text,integer,jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_update_payment_link(
  uuid,uuid,text,text,text,numeric,text,text,text,boolean,timestamptz,text,text,text,integer,jsonb
) TO authenticated;

-- New internal creation overload. The Payment Link row is locked before reading
-- configuration/capacity, so concurrent distinct checkouts cannot consume the same last slot.
CREATE OR REPLACE FUNCTION public.pay_create_payment_intent_from_link(
  p_payment_link_id uuid,
  p_merchant_id uuid,
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
  p_scope text,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_purpose text,
  p_customer_custom_fields jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $pay_create_link_intent_v2$
DECLARE
  v_link public.pay_payment_links%rowtype;
  v_existing public.pay_idempotency_keys%rowtype;
  v_result jsonb;
  v_resource_id uuid;
  v_active_count bigint;
  v_first_name text := nullif(regexp_replace(coalesce(p_customer_first_name,''),'[[:space:]]+',' ','g'),'');
  v_last_name text := nullif(regexp_replace(coalesce(p_customer_last_name,''),'[[:space:]]+',' ','g'),'');
  v_purpose text := nullif(regexp_replace(coalesce(p_customer_purpose,''),'[[:space:]]+',' ','g'),'');
  v_custom_values jsonb;
  v_metadata jsonb;
BEGIN
  IF p_payment_link_id IS NULL
     OR p_merchant_id IS NULL
     OR p_idempotency_key IS NULL
     OR char_length(trim(p_idempotency_key)) < 1
     OR char_length(trim(p_idempotency_key)) > 255
     OR p_request_hash IS NULL
     OR char_length(trim(p_request_hash)) < 1
     OR p_scope <> 'payment-intents:link'
     OR p_amount_atomic IS NULL
     OR p_amount_atomic <= 0
     OR p_amount_atomic <> trunc(p_amount_atomic)
     OR p_asset NOT IN ('SOL','USDC','USDT')
     OR p_fee_payer NOT IN ('merchant','customer')
     OR p_fee_bps <> 100
     OR p_fee_atomic IS NULL OR p_fee_atomic < 0 OR p_fee_atomic <> trunc(p_fee_atomic)
     OR p_customer_total_atomic IS NULL OR p_customer_total_atomic <= 0 OR p_customer_total_atomic <> trunc(p_customer_total_atomic)
     OR p_merchant_net_atomic IS NULL OR p_merchant_net_atomic <= 0 OR p_merchant_net_atomic <> trunc(p_merchant_net_atomic)
     OR p_expires_at IS NULL OR p_expires_at <= now()
     OR v_first_name IS NULL OR char_length(v_first_name) > 120
     OR v_last_name IS NULL OR char_length(v_last_name) > 120
     OR v_purpose IS NULL OR char_length(v_purpose) > 1000
     OR p_metadata IS NULL OR jsonb_typeof(p_metadata) <> 'object' THEN
    RETURN jsonb_build_object('state','invalid');
  END IF;

  SELECT * INTO v_link
    FROM public.pay_payment_links
   WHERE id = p_payment_link_id
     AND merchant_id = p_merchant_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('state','payment_link_unavailable');
  END IF;

  -- Idempotent replays take precedence over capacity and current active/expiry status.
  SELECT * INTO v_existing
    FROM public.pay_idempotency_keys
   WHERE merchant_id = p_merchant_id
     AND scope = p_scope
     AND idempotency_key = trim(p_idempotency_key)
   FOR UPDATE;

  IF FOUND THEN
    IF v_existing.request_hash <> trim(p_request_hash) THEN
      RETURN jsonb_build_object('state','conflict');
    END IF;
    IF v_existing.status = 'completed' AND v_existing.response_body IS NOT NULL THEN
      RETURN jsonb_build_object(
        'state','replay',
        'response_body',v_existing.response_body,
        'response_status',coalesce(v_existing.response_status,200),
        'resource_id',v_existing.resource_id
      );
    END IF;
    IF v_existing.status = 'processing' THEN
      RETURN jsonb_build_object('state','in_progress');
    END IF;
    RETURN jsonb_build_object('state','error');
  END IF;

  IF NOT v_link.is_active OR (v_link.expires_at IS NOT NULL AND v_link.expires_at <= now()) THEN
    RETURN jsonb_build_object('state','payment_link_unavailable');
  END IF;

  -- A stale public page cannot create an intent with an earlier amount/asset/fee policy.
  IF p_amount_atomic <> v_link.fixed_amount_atomic
     OR p_asset <> v_link.asset
     OR p_fee_payer <> v_link.fee_payer THEN
    RETURN jsonb_build_object('state','payment_link_changed');
  END IF;

  IF NOT public.pay_validate_payment_link_checkout_fields(v_link.checkout_fields) THEN
    RETURN jsonb_build_object('state','invalid_custom_fields');
  END IF;

  BEGIN
    v_custom_values := public.pay_normalize_payment_link_checkout_field_values(
      v_link.checkout_fields,
      coalesce(p_customer_custom_fields,'{}'::jsonb)
    );
  EXCEPTION WHEN others THEN
    RETURN jsonb_build_object('state','invalid_custom_fields');
  END;

  SELECT count(*) INTO v_active_count
    FROM public.pay_payment_intents i
   WHERE i.payment_link_id = v_link.id
     AND (
       i.status = 'completed'
       OR (
         i.status IN ('created','pending','detected','verifying','confirmed')
         AND i.expires_at > now()
       )
     );

  IF v_link.max_payments IS NOT NULL AND v_active_count >= v_link.max_payments THEN
    RETURN jsonb_build_object('state','capacity_reached');
  END IF;

  v_metadata := p_metadata || jsonb_build_object(
    'paymentLinkId',v_link.id,
    'paymentLinkSlug',v_link.slug,
    'paymentLinkTitle',v_link.title,
    'paymentLinkDescription',v_link.description,
    'paymentLinkCheckoutLocale',v_link.checkout_locale
  );

  v_result := public.pay_create_payment_intent(
    p_merchant_id,
    NULL,
    p_amount_atomic,
    p_asset,
    p_token_mint,
    p_token_program,
    p_token_decimals,
    p_recipient,
    p_reference,
    p_fee_bps,
    p_fee_payer,
    p_fee_atomic,
    p_customer_total_atomic,
    p_merchant_net_atomic,
    p_fee_recipient,
    p_network,
    p_expires_at,
    v_metadata,
    trim(p_idempotency_key),
    trim(p_request_hash),
    p_scope
  );

  IF v_result->>'state' <> 'created' THEN
    RETURN v_result;
  END IF;

  v_resource_id := nullif(v_result->>'resource_id','')::uuid;

  UPDATE public.pay_payment_intents
     SET payment_link_id = v_link.id,
         customer_first_name = v_first_name,
         customer_last_name = v_last_name,
         customer_purpose = v_purpose,
         payment_link_success_url = v_link.success_url,
         payment_link_checkout_fields = v_link.checkout_fields,
         customer_custom_fields = v_custom_values
   WHERE id = v_resource_id
     AND merchant_id = p_merchant_id
     AND (payment_link_id IS NULL OR payment_link_id = v_link.id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment Link association or custom Checkout snapshot update failed';
  END IF;

  RETURN v_result;
END;
$pay_create_link_intent_v2$;

-- Preserve the current payer-identity signature for deployed callers, but route it
-- through the same row lock/capacity control. If required custom fields are configured,
-- this compatibility call safely fails validation rather than silently omitting them.
CREATE OR REPLACE FUNCTION public.pay_create_payment_intent_from_link(
  p_payment_link_id uuid,
  p_merchant_id uuid,
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
  p_scope text,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_purpose text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $pay_create_link_intent_compat$
BEGIN
  RETURN public.pay_create_payment_intent_from_link(
    p_payment_link_id,p_merchant_id,p_amount_atomic,p_asset,p_token_mint,p_token_program,
    p_token_decimals,p_recipient,p_reference,p_fee_bps,p_fee_payer,p_fee_atomic,
    p_customer_total_atomic,p_merchant_net_atomic,p_fee_recipient,p_network,p_expires_at,
    p_metadata,p_idempotency_key,p_request_hash,p_scope,p_customer_first_name,
    p_customer_last_name,p_customer_purpose,'{}'::jsonb
  );
END;
$pay_create_link_intent_compat$;

REVOKE ALL ON FUNCTION public.pay_create_payment_intent_from_link(
  uuid,uuid,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.pay_create_payment_intent_from_link(
  uuid,uuid,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text,text,text,text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pay_create_payment_intent_from_link(
  uuid,uuid,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text,text,text,text,jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_create_payment_intent_from_link(
  uuid,uuid,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text,text,text,text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.pay_create_payment_intent_from_link(
  uuid,uuid,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text,text,text,text,jsonb
) TO service_role;

COMMENT ON FUNCTION public.pay_create_payment_intent_from_link(
  uuid,uuid,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text,text,text,text,jsonb
) IS
  'Service-role-only Payment Link Checkout creator. Locks the link row, enforces capacity, and snapshots the redirect and validated custom fields.';
