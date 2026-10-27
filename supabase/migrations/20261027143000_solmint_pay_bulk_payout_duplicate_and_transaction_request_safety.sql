begin;

-- Production preflight found no existing batches with duplicate recipients.
create unique index if not exists pay_payout_items_batch_recipient_uq
  on public.pay_payout_items(batch_id, recipient);

-- Private transaction snapshots/leases are intentionally not selectable through Data API.
create table if not exists public.pay_payout_transaction_requests (
  batch_id uuid primary key references public.pay_payout_batches(id) on delete cascade,
  claim_token text,
  claim_expires_at timestamptz,
  prepared_transaction text,
  prepared_blockhash text,
  prepared_last_valid_block_height bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_payout_transaction_request_claim_pair check (
    (claim_token is null and claim_expires_at is null)
    or (claim_token is not null and claim_expires_at is not null)
  ),
  constraint pay_payout_transaction_request_prepared_tuple check (
    (prepared_transaction is null and prepared_blockhash is null and prepared_last_valid_block_height is null)
    or (prepared_transaction is not null and prepared_blockhash is not null and prepared_last_valid_block_height > 0)
  )
);
alter table public.pay_payout_transaction_requests enable row level security;
revoke all on table public.pay_payout_transaction_requests from PUBLIC, anon, authenticated;

create or replace function public.pay_create_payout_batch(
  p_merchant_id uuid,p_asset text,p_token_mint text,p_token_program text,p_token_decimals integer,
  p_items jsonb,p_idempotency_key text,p_request_hash text
) returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_user_id text; v_wallet_count integer; v_wallet_address text; v_batch public.pay_payout_batches%rowtype;
  v_item jsonb; v_items jsonb := '[]'::jsonb; v_total numeric := 0; v_count integer; v_line integer := 0;
  v_existing public.pay_idempotency_keys%rowtype; v_response jsonb;
begin
  if current_setting('role',true) <> 'authenticated' then return jsonb_build_object('state','unauthorized'); end if;
  v_user_id := public.pay_request_user_id();
  if v_user_id is null then return jsonb_build_object('state','unauthorized'); end if;

  if p_merchant_id is null or p_asset is null or p_asset not in ('SOL','USDC','USDT')
     or p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 50
     or p_idempotency_key is null or char_length(trim(p_idempotency_key)) not between 1 and 255
     or p_request_hash is null or char_length(trim(p_request_hash)) < 1 then
    return jsonb_build_object('state','invalid');
  end if;

  if p_asset='SOL' and (p_token_mint is not null or p_token_program is not null or p_token_decimals is not null) then
    return jsonb_build_object('state','invalid');
  end if;
  if p_asset in ('USDC','USDT') and (p_token_mint is null or p_token_program <> 'spl-token' or p_token_decimals is null or p_token_decimals not between 0 and 255) then
    return jsonb_build_object('state','invalid');
  end if;
  if not public.pay_has_merchant_access(p_merchant_id,array['owner','admin','finance']::text[]) then return jsonb_build_object('state','forbidden'); end if;
  if not exists (select 1 from public.pay_merchants m where m.id=p_merchant_id and m.status='active') then return jsonb_build_object('state','merchant_not_active'); end if;

  select count(*),max(w.address) into v_wallet_count,v_wallet_address
  from public.pay_merchant_wallets w
  where w.merchant_id=p_merchant_id and w.wallet_role='receiving' and w.is_active=true and w.verification_status='verified';
  if v_wallet_count <> 1 or v_wallet_address is null then return jsonb_build_object('state','wallet_not_ready'); end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object'
       or jsonb_typeof(v_item->'recipient') <> 'string'
       or jsonb_typeof(v_item->'amountAtomic') <> 'string'
       or char_length(trim(v_item->>'recipient')) not between 32 and 44
       or trim(v_item->>'recipient') !~ '^[1-9A-HJ-NP-Za-km-z]+$'
       or trim(v_item->>'amountAtomic') !~ '^[0-9]{1,78}$'
       or trim(v_item->>'amountAtomic')::numeric <= 0 then
      return jsonb_build_object('state','invalid');
    end if;
    v_line := v_line + 1;
    v_total := v_total + trim(v_item->>'amountAtomic')::numeric;
    v_items := v_items || jsonb_build_array(jsonb_build_object('recipient',trim(v_item->>'recipient'),'amountAtomic',trim(v_item->>'amountAtomic')));
  end loop;
  v_count := jsonb_array_length(v_items);
  if v_count < 1 or v_count > 50 or v_total <= 0 or v_total >= power(10::numeric,78) then return jsonb_build_object('state','invalid'); end if;

  if exists (
    select 1 from jsonb_array_elements(v_items) as payout_item(item)
    group by payout_item.item->>'recipient'
    having count(*) > 1
  ) then
    return jsonb_build_object('state','duplicate_recipient');
  end if;


  insert into public.pay_idempotency_keys(merchant_id,scope,idempotency_key,request_hash,status)
  values(p_merchant_id,'payout-batches:create',trim(p_idempotency_key),trim(p_request_hash),'processing')
  on conflict (merchant_id,scope,idempotency_key) do nothing
  returning * into v_existing;
  if not found then
    select * into v_existing from public.pay_idempotency_keys where merchant_id=p_merchant_id and scope='payout-batches:create' and idempotency_key=trim(p_idempotency_key) for update;
    if not found then return jsonb_build_object('state','error'); end if;
    if v_existing.request_hash <> trim(p_request_hash) then return jsonb_build_object('state','conflict'); end if;
    if v_existing.status='completed' and v_existing.response_body is not null then return jsonb_build_object('state','replay','response_body',v_existing.response_body,'response_status',coalesce(v_existing.response_status,201),'resource_id',v_existing.resource_id); end if;
    if v_existing.status='processing' then return jsonb_build_object('state','in_progress'); end if;
    return jsonb_build_object('state','error');
  end if;

  insert into public.pay_payout_batches(merchant_id,created_by_user_id,asset,token_mint,token_program,token_decimals,source_wallet_address,total_amount_atomic,item_count,status,verification_commitment)
  values(p_merchant_id,v_user_id,p_asset,p_token_mint,p_token_program,p_token_decimals,v_wallet_address,v_total,v_count,'ready','finalized')
  returning * into v_batch;

  v_line := 0;
  for v_item in select value from jsonb_array_elements(v_items) loop
    v_line := v_line + 1;
    insert into public.pay_payout_items(batch_id,line_number,recipient,amount_atomic,status)
    values(v_batch.id,v_line,trim(v_item->>'recipient'),trim(v_item->>'amountAtomic')::numeric,'ready');
  end loop;

  insert into public.pay_audit_logs(merchant_id,actor_user_id,event_type,entity_type,entity_id,request_id,metadata)
  values(p_merchant_id,v_user_id,'payout.batch.created','payout_batch',v_batch.id::text,null,
         jsonb_build_object('asset',v_batch.asset,'total_amount_atomic',v_batch.total_amount_atomic::text,'item_count',v_batch.item_count,'source_wallet_address',v_batch.source_wallet_address));

  v_response := jsonb_build_object('apiVersion','v1','data',jsonb_build_object(
    'id',v_batch.id,'merchantId',v_batch.merchant_id,'createdByUserId',v_batch.created_by_user_id,'asset',v_batch.asset,
    'tokenMint',v_batch.token_mint,'tokenProgram',v_batch.token_program,'tokenDecimals',v_batch.token_decimals,
    'sourceWalletAddress',v_batch.source_wallet_address,'totalAmountAtomic',v_batch.total_amount_atomic::text,'itemCount',v_batch.item_count,
    'status',v_batch.status,'verificationCommitment',v_batch.verification_commitment,'transactionSignature',v_batch.transaction_signature,
    'transactionSlot',v_batch.transaction_slot,'transactionBlockTime',v_batch.transaction_block_time,'failureCode',v_batch.failure_code,
    'failureReason',v_batch.failure_reason,'verificationSummary',v_batch.verification_summary,'createdAt',v_batch.created_at,'updatedAt',v_batch.updated_at
  ));

  update public.pay_idempotency_keys set status='completed',response_status=201,response_body=v_response,resource_type='payout_batch',resource_id=v_batch.id,completed_at=now()
  where merchant_id=p_merchant_id and scope='payout-batches:create' and idempotency_key=trim(p_idempotency_key) and status='processing';
  if not found then raise exception 'payout batch idempotency completion failed'; end if;

  return jsonb_build_object('state','created','response_status',201,'response_body',v_response,'resource_id',v_batch.id);
exception when unique_violation then
  delete from public.pay_idempotency_keys where merchant_id=p_merchant_id and scope='payout-batches:create' and idempotency_key=trim(p_idempotency_key);
  return jsonb_build_object('state','conflict');
end;
$function$;


create or replace function public.pay_claim_payout_transaction_request(
  p_merchant_id uuid,p_batch_id uuid,p_claim_token text,p_request_id text
) returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_user_id text; v_batch public.pay_payout_batches%rowtype; v_request public.pay_payout_transaction_requests%rowtype;
begin
  if current_setting('role',true) <> 'authenticated'
     or coalesce(auth.jwt()->>'solmint_pay_payout_builder','') <> 'true' then
    return jsonb_build_object('state','unauthorized');
  end if;
  v_user_id := public.pay_request_user_id();
  if v_user_id is null then return jsonb_build_object('state','unauthorized'); end if;
  if p_merchant_id is null or p_batch_id is null or p_claim_token is null
     or p_claim_token !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return jsonb_build_object('state','invalid');
  end if;

  select * into v_batch from public.pay_payout_batches
  where id=p_batch_id and merchant_id=p_merchant_id for update;
  if not found then return jsonb_build_object('state','not_found'); end if;
  if not public.pay_has_merchant_access(p_merchant_id,array['owner','admin','finance']::text[]) then
    return jsonb_build_object('state','forbidden');
  end if;
  if v_batch.status <> 'ready' or v_batch.transaction_signature is not null then
    return jsonb_build_object('state','not_ready','status',v_batch.status);
  end if;

  insert into public.pay_payout_transaction_requests(batch_id) values(p_batch_id) on conflict (batch_id) do nothing;
  select * into v_request from public.pay_payout_transaction_requests where batch_id=p_batch_id for update;
  if v_request.prepared_transaction is not null then
    return jsonb_build_object('state','prepared','transaction',v_request.prepared_transaction,'blockhash',v_request.prepared_blockhash,'lastValidBlockHeight',v_request.prepared_last_valid_block_height);
  end if;
  if v_request.claim_token is not null and v_request.claim_expires_at > now() then
    return jsonb_build_object('state','in_progress');
  end if;
  update public.pay_payout_transaction_requests set claim_token=p_claim_token,claim_expires_at=now()+interval '90 seconds',updated_at=now() where batch_id=p_batch_id;
  return jsonb_build_object('state','claimed');
end;
$function$;

create or replace function public.pay_store_payout_transaction_request(
  p_merchant_id uuid,p_batch_id uuid,p_claim_token text,p_transaction text,p_blockhash text,p_last_valid_block_height bigint,p_request_id text
) returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_user_id text; v_batch public.pay_payout_batches%rowtype; v_request public.pay_payout_transaction_requests%rowtype;
begin
  if current_setting('role',true) <> 'authenticated'
     or coalesce(auth.jwt()->>'solmint_pay_payout_builder','') <> 'true' then
    return jsonb_build_object('state','unauthorized');
  end if;
  v_user_id := public.pay_request_user_id();
  if v_user_id is null then return jsonb_build_object('state','unauthorized'); end if;
  if p_merchant_id is null or p_batch_id is null or p_claim_token is null
     or p_claim_token !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or p_transaction is null or char_length(p_transaction) not between 4 and 2000 or p_transaction !~ '^[A-Za-z0-9+/]+={0,2}$'
     or p_blockhash is null or char_length(p_blockhash) not between 32 and 44 or p_blockhash !~ '^[1-9A-HJ-NP-Za-km-z]+$'
     or p_last_valid_block_height is null or p_last_valid_block_height < 1 then
    return jsonb_build_object('state','invalid');
  end if;
  select * into v_batch from public.pay_payout_batches where id=p_batch_id and merchant_id=p_merchant_id for update;
  if not found then return jsonb_build_object('state','not_found'); end if;
  if not public.pay_has_merchant_access(p_merchant_id,array['owner','admin','finance']::text[]) then return jsonb_build_object('state','forbidden'); end if;
  if v_batch.status <> 'ready' or v_batch.transaction_signature is not null then return jsonb_build_object('state','not_ready'); end if;

  select * into v_request from public.pay_payout_transaction_requests where batch_id=p_batch_id for update;
  if not found then return jsonb_build_object('state','claim_lost'); end if;
  if v_request.prepared_transaction is not null then
    return jsonb_build_object('state','prepared','transaction',v_request.prepared_transaction,'blockhash',v_request.prepared_blockhash,'lastValidBlockHeight',v_request.prepared_last_valid_block_height);
  end if;
  if v_request.claim_token is distinct from p_claim_token or v_request.claim_expires_at <= now() then return jsonb_build_object('state','claim_lost'); end if;

  update public.pay_payout_transaction_requests set prepared_transaction=p_transaction,prepared_blockhash=p_blockhash,
    prepared_last_valid_block_height=p_last_valid_block_height,claim_token=null,claim_expires_at=null,updated_at=now()
  where batch_id=p_batch_id;
  insert into public.pay_audit_logs(merchant_id,actor_user_id,event_type,entity_type,entity_id,request_id,metadata)
  values(p_merchant_id,v_user_id,'payout.batch.transaction_prepared','payout_batch',p_batch_id::text,p_request_id,
    jsonb_build_object('blockhash',p_blockhash,'lastValidBlockHeight',p_last_valid_block_height));
  return jsonb_build_object('state','prepared','transaction',p_transaction,'blockhash',p_blockhash,'lastValidBlockHeight',p_last_valid_block_height);
end;
$function$;

create or replace function public.pay_get_prepared_payout_transaction_request(
  p_merchant_id uuid,p_batch_id uuid
) returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_user_id text; v_batch public.pay_payout_batches%rowtype; v_request public.pay_payout_transaction_requests%rowtype;
begin
  if current_setting('role',true) <> 'authenticated'
     or coalesce(auth.jwt()->>'solmint_pay_payout_builder','') <> 'true' then
    return jsonb_build_object('state','unauthorized');
  end if;
  v_user_id := public.pay_request_user_id();
  if v_user_id is null then return jsonb_build_object('state','unauthorized'); end if;
  if p_merchant_id is null or p_batch_id is null then return jsonb_build_object('state','invalid'); end if;
  select * into v_batch from public.pay_payout_batches where id=p_batch_id and merchant_id=p_merchant_id;
  if not found then return jsonb_build_object('state','not_found'); end if;
  if not public.pay_has_merchant_access(p_merchant_id,array['owner','admin','finance']::text[]) then return jsonb_build_object('state','forbidden'); end if;
  if v_batch.status not in ('ready','submitted','verifying') then return jsonb_build_object('state','not_ready'); end if;
  select * into v_request from public.pay_payout_transaction_requests where batch_id=p_batch_id;
  if not found or v_request.prepared_transaction is null then return jsonb_build_object('state','not_prepared'); end if;
  return jsonb_build_object('state','prepared','transaction',v_request.prepared_transaction,'blockhash',v_request.prepared_blockhash,
    'lastValidBlockHeight',v_request.prepared_last_valid_block_height,'sourceWalletAddress',v_batch.source_wallet_address);
end;
$function$;

create or replace function public.pay_release_payout_transaction_request(
  p_merchant_id uuid,p_batch_id uuid,p_claim_token text,p_request_id text
) returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_user_id text;
begin
  if current_setting('role',true) <> 'authenticated'
     or coalesce(auth.jwt()->>'solmint_pay_payout_builder','') <> 'true' then
    return jsonb_build_object('state','unauthorized');
  end if;
  v_user_id := public.pay_request_user_id();
  if v_user_id is null then return jsonb_build_object('state','unauthorized'); end if;
  if p_merchant_id is null or p_batch_id is null or p_claim_token is null then return jsonb_build_object('state','invalid'); end if;
  if not public.pay_has_merchant_access(p_merchant_id,array['owner','admin','finance']::text[]) then return jsonb_build_object('state','forbidden'); end if;
  update public.pay_payout_transaction_requests r set claim_token=null,claim_expires_at=null,updated_at=now()
  where r.batch_id=p_batch_id and r.claim_token=p_claim_token and r.prepared_transaction is null
    and exists(select 1 from public.pay_payout_batches b where b.id=r.batch_id and b.merchant_id=p_merchant_id);
  return jsonb_build_object('state','released');
end;
$function$;

revoke all on function public.pay_claim_payout_transaction_request(uuid,uuid,text,text) from PUBLIC, anon;
revoke all on function public.pay_store_payout_transaction_request(uuid,uuid,text,text,text,bigint,text) from PUBLIC, anon;
revoke all on function public.pay_get_prepared_payout_transaction_request(uuid,uuid) from PUBLIC, anon;
revoke all on function public.pay_release_payout_transaction_request(uuid,uuid,text,text) from PUBLIC, anon;
grant execute on function public.pay_claim_payout_transaction_request(uuid,uuid,text,text) to authenticated;
grant execute on function public.pay_store_payout_transaction_request(uuid,uuid,text,text,text,bigint,text) to authenticated;
grant execute on function public.pay_get_prepared_payout_transaction_request(uuid,uuid) to authenticated;
grant execute on function public.pay_release_payout_transaction_request(uuid,uuid,text,text) to authenticated;

commit;
