begin;

-- Apply only after the new server/API code is deployed and production smoke checks pass.
create or replace function public.pay_submit_payout_batch(
  p_merchant_id uuid,p_batch_id uuid,p_signature text,p_idempotency_key text,p_request_hash text
) returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_user_id text; v_batch public.pay_payout_batches%rowtype; v_existing public.pay_idempotency_keys%rowtype; v_response jsonb;
begin
  if current_setting('role',true) <> 'authenticated'
     or coalesce(auth.jwt()->>'solmint_pay_payout_builder','') <> 'true' then
    return jsonb_build_object('state','unauthorized');
  end if;
  v_user_id := public.pay_request_user_id();
  if v_user_id is null then return jsonb_build_object('state','unauthorized'); end if;
  if p_merchant_id is null or p_batch_id is null or p_signature is null or trim(p_signature) !~ '^[1-9A-HJ-NP-Za-km-z]{64,128}$'
     or p_idempotency_key is null or char_length(trim(p_idempotency_key)) not between 1 and 255
     or p_request_hash is null or char_length(trim(p_request_hash)) < 1 then return jsonb_build_object('state','invalid'); end if;

  select * into v_batch from public.pay_payout_batches where id=p_batch_id and merchant_id=p_merchant_id for update;
  if not found then return jsonb_build_object('state','not_found'); end if;
  if not public.pay_has_merchant_access(p_merchant_id,array['owner','admin','finance']::text[]) then return jsonb_build_object('state','forbidden'); end if;

  insert into public.pay_idempotency_keys(merchant_id,scope,idempotency_key,request_hash,status)
  values(p_merchant_id,'payout-batches:submit',trim(p_idempotency_key),trim(p_request_hash),'processing')
  on conflict (merchant_id,scope,idempotency_key) do nothing returning * into v_existing;
  if not found then
    select * into v_existing from public.pay_idempotency_keys where merchant_id=p_merchant_id and scope='payout-batches:submit' and idempotency_key=trim(p_idempotency_key) for update;
    if not found then return jsonb_build_object('state','error'); end if;
    if v_existing.request_hash <> trim(p_request_hash) then return jsonb_build_object('state','conflict'); end if;
    if v_existing.status='completed' and v_existing.response_body is not null then return jsonb_build_object('state','replay','response_body',v_existing.response_body,'response_status',coalesce(v_existing.response_status,202),'resource_id',v_existing.resource_id); end if;
    if v_existing.status='processing' then return jsonb_build_object('state','in_progress'); end if;
    return jsonb_build_object('state','error');
  end if;

  if v_batch.status not in ('ready','submitted','verifying') then delete from public.pay_idempotency_keys where id=v_existing.id; return jsonb_build_object('state','not_submitable','status',v_batch.status); end if;
  if v_batch.transaction_signature is not null and v_batch.transaction_signature <> trim(p_signature) then delete from public.pay_idempotency_keys where id=v_existing.id; return jsonb_build_object('state','signature_conflict'); end if;

  update public.pay_payout_batches set transaction_signature=trim(p_signature),status=case when status='ready' then 'submitted' else status end,updated_at=now()
  where id=v_batch.id and merchant_id=v_batch.merchant_id returning * into v_batch;
  update public.pay_payout_items set status='submitted',updated_at=now() where batch_id=v_batch.id and status='ready';

  insert into public.pay_audit_logs(merchant_id,actor_user_id,event_type,entity_type,entity_id,request_id,metadata)
  values(v_batch.merchant_id,v_user_id,'payout.batch.submitted','payout_batch',v_batch.id::text,null,jsonb_build_object('signature',v_batch.transaction_signature));

  v_response := jsonb_build_object('apiVersion','v1','data',jsonb_build_object(
    'id',v_batch.id,'merchantId',v_batch.merchant_id,'createdByUserId',v_batch.created_by_user_id,'asset',v_batch.asset,
    'tokenMint',v_batch.token_mint,'tokenProgram',v_batch.token_program,'tokenDecimals',v_batch.token_decimals,
    'sourceWalletAddress',v_batch.source_wallet_address,'totalAmountAtomic',v_batch.total_amount_atomic::text,'itemCount',v_batch.item_count,
    'status',v_batch.status,'verificationCommitment',v_batch.verification_commitment,'transactionSignature',v_batch.transaction_signature,
    'transactionSlot',v_batch.transaction_slot,'transactionBlockTime',v_batch.transaction_block_time,'failureCode',v_batch.failure_code,
    'failureReason',v_batch.failure_reason,'verificationSummary',v_batch.verification_summary,'createdAt',v_batch.created_at,'updatedAt',v_batch.updated_at
  ));
  update public.pay_idempotency_keys set status='completed',response_status=202,response_body=v_response,resource_type='payout_batch',resource_id=v_batch.id,completed_at=now()
  where id=v_existing.id and status='processing';
  if not found then raise exception 'payout batch submit idempotency completion failed'; end if;
  return jsonb_build_object('state','submitted','response_status',202,'response_body',v_response,'resource_id',v_batch.id);
exception when unique_violation then
  delete from public.pay_idempotency_keys where merchant_id=p_merchant_id and scope='payout-batches:submit' and idempotency_key=trim(p_idempotency_key);
  return jsonb_build_object('state','signature_conflict');
end;
$function$;

commit;
