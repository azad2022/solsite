-- Replay binding hardening.
-- Rejected observations are evidence, not consumed payments. Only an authoritative
-- transaction must enter the replay blocklist used by the verifier.

create or replace function public.pay_record_rejected_observation(
  p_payment_id uuid,
  p_signature text,
  p_slot bigint,
  p_block_time timestamptz,
  p_success boolean,
  p_commitment text,
  p_fee_payer text,
  p_observed_amount_atomic numeric default null,
  p_asset text default null,
  p_recipient text default null,
  p_reference_matched boolean default false,
  p_reason text default null,
  p_raw_observation jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_payment_id uuid;
begin
  if p_signature is null or length(trim(p_signature)) < 32 then
    return jsonb_build_object('ok', false, 'reason', 'INVALID_SIGNATURE');
  end if;

  select id, payment_id into v_id, v_payment_id
    from public.pay_payment_transactions
   where signature = p_signature;

  if v_id is not null and v_payment_id <> p_payment_id then
    return jsonb_build_object('ok', false, 'reason', 'SIGNATURE_ALREADY_BOUND');
  end if;

  if v_id is null then
    insert into public.pay_payment_transactions(
      payment_id, signature, slot, block_time, observed_amount_atomic, asset,
      recipient, reference_matched, confirmed, success, commitment, fee_payer,
      verification_status, is_authoritative, raw_transaction, observed_at, rejection_reason
    ) values (
      p_payment_id, p_signature, p_slot, p_block_time, p_observed_amount_atomic,
      coalesce(p_asset, 'SOL'), coalesce(p_recipient,''), coalesce(p_reference_matched,false), false,
      coalesce(p_success,false), p_commitment, p_fee_payer, 'rejected', false,
      coalesce(p_raw_observation,'{}'::jsonb), now(), p_reason
    ) returning id into v_id;
  else
    update public.pay_payment_transactions
       set slot = p_slot,
           block_time = p_block_time,
           observed_amount_atomic = p_observed_amount_atomic,
           asset = coalesce(p_asset, asset),
           recipient = coalesce(p_recipient, recipient),
           commitment = p_commitment,
           success = coalesce(p_success,false),
           fee_payer = p_fee_payer,
           reference_matched = coalesce(p_reference_matched,false),
           verification_status = case when is_authoritative then verification_status else 'rejected' end,
           raw_transaction = coalesce(p_raw_observation,'{}'::jsonb),
           observed_at = now(),
           rejection_reason = p_reason
     where id = v_id and payment_id = p_payment_id;
  end if;

  insert into public.pay_payment_events(payment_id, event_type, actor_type, payload)
  values (
    p_payment_id,
    'payment.observation_rejected',
    'system',
    jsonb_build_object('signature', p_signature, 'reason', p_reason)
  );

  return jsonb_build_object('ok', true, 'transaction_id', v_id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'SIGNATURE_ALREADY_BOUND');
end;
$$;

revoke all on function public.pay_record_rejected_observation(uuid,text,bigint,timestamptz,boolean,text,text,numeric,text,text,boolean,text,jsonb) from public, anon, authenticated;
grant execute on function public.pay_record_rejected_observation(uuid,text,bigint,timestamptz,boolean,text,text,numeric,text,text,boolean,text,jsonb) to service_role;
