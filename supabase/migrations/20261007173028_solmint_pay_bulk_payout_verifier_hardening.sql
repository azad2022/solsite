begin;

create or replace function public.pay_apply_payout_verification(
  p_merchant_id uuid,p_batch_id uuid,p_signature text,p_status text,p_failure_code text,p_failure_reason text,p_slot bigint,p_block_time timestamptz,p_verification_summary jsonb,p_request_id text
) returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_user_id text; v_batch public.pay_payout_batches%rowtype;
begin
  if current_setting('role',true) <> 'authenticated' then return jsonb_build_object('state','unauthorized'); end if;
  if coalesce(auth.jwt()->>'solmint_pay_verifier','') <> 'true' then return jsonb_build_object('state','unauthorized'); end if;
  v_user_id := public.pay_request_user_id();
  if v_user_id is null then return jsonb_build_object('state','unauthorized'); end if;
  if p_merchant_id is null or p_batch_id is null or p_signature is null or trim(p_signature) !~ '^[1-9A-HJ-NP-Za-km-z]{64,128}$' or p_status not in ('completed','failed') then return jsonb_build_object('state','invalid'); end if;
  select * into v_batch from public.pay_payout_batches where id=p_batch_id and merchant_id=p_merchant_id for update;
  if not found then return jsonb_build_object('state','not_found'); end if;
  if not public.pay_has_merchant_access(p_merchant_id,array['owner','admin','finance']::text[]) then return jsonb_build_object('state','forbidden'); end if;
  if v_batch.transaction_signature <> trim(p_signature) then return jsonb_build_object('state','signature_mismatch'); end if;
  if v_batch.status in ('completed','failed') then return jsonb_build_object('state','already_final','status',v_batch.status); end if;
  update public.pay_payout_batches set status=p_status,transaction_slot=p_slot,transaction_block_time=p_block_time,
    failure_code=case when p_status='failed' then nullif(trim(coalesce(p_failure_code,'')),'') else null end,
    failure_reason=case when p_status='failed' then nullif(trim(coalesce(p_failure_reason,'')),'') else null end,
    verification_summary=coalesce(p_verification_summary,'{}'::jsonb),updated_at=now() where id=v_batch.id;
  update public.pay_payout_items set status=case when p_status='completed' then 'completed' else 'failed' end,
    failure_code=case when p_status='failed' then nullif(trim(coalesce(p_failure_code,'')),'') else null end,
    failure_reason=case when p_status='failed' then nullif(trim(coalesce(p_failure_reason,'')),'') else null end,
    updated_at=now() where batch_id=v_batch.id;
  insert into public.pay_audit_logs(merchant_id,actor_user_id,event_type,entity_type,entity_id,request_id,metadata)
  values(v_batch.merchant_id,v_user_id,case when p_status='completed' then 'payout.batch.completed' else 'payout.batch.failed' end,'payout_batch',v_batch.id::text,p_request_id,
    jsonb_build_object('signature',trim(p_signature),'status',p_status,'failureCode',p_failure_code,'failureReason',p_failure_reason,'slot',p_slot,'blockTime',p_block_time,'verificationSummary',coalesce(p_verification_summary,'{}'::jsonb)));
  return jsonb_build_object('state','updated','status',p_status);
end;
$function$;

commit;