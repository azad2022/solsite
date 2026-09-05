-- Restore the two authoritative invariants weakened by 20260905000200:
-- sponsored payments fail closed, and fee payer must equal the transfer source authority.
-- The existing token-account destination-authority logic is preserved verbatim.

do $$
declare
  v_definition text;
  old_signature_guard text := E'  if p_signature is null or p_success is distinct from true or p_reference_matched is distinct from true or p_commitment is distinct from v_payment.verification_commitment then return jsonb_build_object(\'ok\', false, \'reason\', \'OBSERVATION_INVARIANT_FAILED\'); end if;';
  new_signature_guard text := E'  if v_payment.gas_sponsored is distinct from false then return jsonb_build_object(\'ok\', false, \'reason\', \'SPONSORING_NOT_SUPPORTED\'); end if;\n  if p_signature is null or p_signature = \'\' or p_success is distinct from true or p_reference_matched is distinct from true or p_commitment is distinct from v_payment.verification_commitment or p_fee_payer is null or p_fee_payer = \'\' then return jsonb_build_object(\'ok\', false, \'reason\', \'OBSERVATION_INVARIANT_FAILED\'); end if;';
  old_sender_guard text := E'  if v_merchant_source_authority is null or v_fee_source_authority is null or v_merchant_source_authority <> v_fee_source_authority then return jsonb_build_object(\'ok\', false, \'reason\', \'SENDER_INVARIANT_FAILED\'); end if;\n  if v_payment.asset <> \'SOL\' and exists (select 1 from jsonb_array_elements(p_transfers) x where x->>\'role\' in (\'merchant_settlement\',\'gateway_fee\') and (x->>\'destinationAuthority\') is null) then return jsonb_build_object(\'ok\', false, \'reason\', \'TOKEN_ACCOUNT_INVARIANT_FAILED\'); end if;';
  new_sender_guard text := old_sender_guard || E'\n  if p_fee_payer <> v_merchant_source_authority then return jsonb_build_object(\'ok\', false, \'reason\', \'FEE_PAYER_MISMATCH\'); end if;';
begin
  select pg_get_functiondef(p.oid)
    into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public'
     and p.proname='pay_apply_verified_observation'
     and pg_get_function_identity_arguments(p.oid)='p_payment_id uuid, p_signature text, p_slot bigint, p_block_time timestamp with time zone, p_observed_amount_atomic numeric, p_asset text, p_recipient text, p_reference_matched boolean, p_success boolean, p_commitment text, p_fee_payer text, p_network_fee_lamports numeric, p_transfers jsonb, p_raw_observation jsonb, p_verified_at timestamp with time zone, p_request_id text'
   limit 1;
  if v_definition is null then raise exception 'Expected authoritative reconciliation function is missing'; end if;
  if position('v_payment.gas_sponsored is distinct from false' in v_definition)=0 then
    if position(old_signature_guard in v_definition)=0 then raise exception 'Signature guard marker not found'; end if;
    v_definition:=replace(v_definition,old_signature_guard,new_signature_guard);
  end if;
  if position('p_fee_payer <> v_merchant_source_authority' in v_definition)=0 then
    if position(old_sender_guard in v_definition)=0 then raise exception 'Sender guard marker not found'; end if;
    v_definition:=replace(v_definition,old_sender_guard,new_sender_guard);
  end if;
  if position('v_payment.gas_sponsored is distinct from false' in v_definition)=0 then raise exception 'Sponsorship guard not installed'; end if;
  if position('p_fee_payer <> v_merchant_source_authority' in v_definition)=0 then raise exception 'Fee-payer guard not installed'; end if;
  execute v_definition;
end;
$$;

revoke all on function public.pay_apply_verified_observation(uuid,text,bigint,timestamptz,numeric,text,text,boolean,boolean,text,text,numeric,jsonb,jsonb,timestamptz,text) from public,anon,authenticated;
grant execute on function public.pay_apply_verified_observation(uuid,text,bigint,timestamptz,numeric,text,text,boolean,boolean,text,text,numeric,jsonb,jsonb,timestamptz,text) to service_role;
