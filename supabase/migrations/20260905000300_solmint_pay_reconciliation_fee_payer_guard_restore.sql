-- Restore two authoritative reconciliation invariants weakened by the preceding
-- token-destination migration while preserving its token-account semantics.

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'pay_apply_verified_observation'
     and pg_get_function_identity_arguments(p.oid) = 'p_payment_id uuid, p_signature text, p_slot bigint, p_block_time timestamp with time zone, p_observed_amount_atomic numeric, p_asset text, p_recipient text, p_reference_matched boolean, p_success boolean, p_commitment text, p_fee_payer text, p_network_fee_lamports numeric, p_transfers jsonb, p_raw_observation jsonb, p_verified_at timestamp with time zone, p_request_id text'
   limit 1;

  if v_definition is null then
    raise exception 'Expected authoritative reconciliation function is missing';
  end if;

  if position('v_payment.gas_sponsored is distinct from false' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      E'  if p_signature is null or p_signature = \'\' or p_success is distinct from true\n',
      E'  if v_payment.gas_sponsored is distinct from false then\n    return jsonb_build_object(\'ok\',false,\'reason\',\'SPONSORING_NOT_SUPPORTED\');\n  end if;\n\n  if p_signature is null or p_signature = \'\' or p_success is distinct from true\n'
    );
  end if;

  if position('or p_fee_payer is null or p_fee_payer = ' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      E'     or p_commitment is distinct from v_payment.verification_commitment\n',
      E'     or p_commitment is distinct from v_payment.verification_commitment\n     or p_fee_payer is null or p_fee_payer = \'\'\n'
    );
  end if;

  if position('p_fee_payer<>v_merchant_source_authority' in replace(v_definition, ' ', '')) = 0
     and position('p_fee_payer <> v_merchant_source_authority' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      E'  if v_merchant_destination_authority<>v_payment.recipient or v_fee_destination_authority<>v_payment.fee_recipient then\n',
      E'  if p_fee_payer <> v_merchant_source_authority then\n    return jsonb_build_object(\'ok\',false,\'reason\',\'FEE_PAYER_MISMATCH\');\n  end if;\n\n  if v_merchant_destination_authority<>v_payment.recipient or v_fee_destination_authority<>v_payment.fee_recipient then\n'
    );
  end if;

  if position('p_fee_payer <> v_merchant_source_authority' in v_definition) = 0 then
    raise exception 'Failed to install fee-payer binding guard';
  end if;
  if position('v_payment.gas_sponsored is distinct from false' in v_definition) = 0 then
    raise exception 'Failed to install sponsorship guard';
  end if;

  execute v_definition;
end;
$$;

revoke all on function public.pay_apply_verified_observation(uuid,text,bigint,timestamptz,numeric,text,text,boolean,boolean,text,text,numeric,jsonb,jsonb,timestamptz,text) from public,anon,authenticated;
grant execute on function public.pay_apply_verified_observation(uuid,text,bigint,timestamptz,numeric,text,text,boolean,boolean,text,text,numeric,jsonb,jsonb,timestamptz,text) to service_role;
