-- SolMint Pay Bulk Payout foundation.
-- A payout batch is a merchant-originated, non-custodial, single-transaction
-- operation. The merchant's verified receiving wallet signs the transaction.
-- No automatic transaction splitting is performed in this release.

create table public.pay_payout_batches (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.pay_merchants(id) on delete restrict,
  created_by_user_id text not null references public.users(id) on delete restrict,
  asset text not null check (asset in ('SOL','USDC','USDT')),
  token_mint text null,
  token_program text null check (token_program is null or token_program = 'spl-token'),
  token_decimals integer null check (token_decimals is null or (token_decimals between 0 and 255)),
  source_wallet_address text not null,
  total_amount_atomic numeric not null check (total_amount_atomic > 0 and total_amount_atomic = trunc(total_amount_atomic) and total_amount_atomic < power(10::numeric, 78)),
  item_count integer not null check (item_count between 1 and 50),
  status text not null default 'ready' check (status in ('ready','submitted','verifying','completed','failed')),
  transaction_signature text null,
  transaction_slot bigint null,
  transaction_block_time timestamptz null,
  failure_code text null,
  failure_reason text null,
  verification_commitment text not null default 'finalized' check (verification_commitment = 'finalized'),
  verification_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_payout_batch_token_shape check (
    (asset = 'SOL' and token_mint is null and token_program is null and token_decimals is null)
    or
    (asset in ('USDC','USDT') and token_mint is not null and token_program = 'spl-token' and token_decimals is not null)
  ),
  constraint pay_payout_batch_signature_format check (
    transaction_signature is null
    or transaction_signature ~ '^[1-9A-HJ-NP-Za-km-z]{64,128}$'
  )
);

create unique index pay_payout_batches_transaction_signature_uq
  on public.pay_payout_batches(transaction_signature)
  where transaction_signature is not null;

create index pay_payout_batches_merchant_created_idx
  on public.pay_payout_batches(merchant_id, created_at desc);

create table public.pay_payout_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.pay_payout_batches(id) on delete cascade,
  line_number integer not null check (line_number between 1 and 50),
  recipient text not null,
  amount_atomic numeric not null check (amount_atomic > 0 and amount_atomic = trunc(amount_atomic) and amount_atomic < power(10::numeric, 78)),
  status text not null default 'ready' check (status in ('ready','submitted','completed','failed')),
  failure_code text null,
  failure_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(batch_id, line_number)
);

create index pay_payout_items_batch_idx on public.pay_payout_items(batch_id, line_number);

alter table public.pay_payout_batches enable row level security;
alter table public.pay_payout_items enable row level security;

revoke all on table public.pay_payout_batches from public, anon, authenticated;
revoke all on table public.pay_payout_items from public, anon, authenticated;
grant select on table public.pay_payout_batches to authenticated;
grant select on table public.pay_payout_items to authenticated;

create policy "pay payout batches read merchant scoped"
  on public.pay_payout_batches
  for select
  to authenticated
  using (
    public.pay_has_merchant_access(
      merchant_id,
      array['owner','admin','finance','developer','viewer']::text[]
    )
  );

create policy "pay payout items read merchant scoped"
  on public.pay_payout_items
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.pay_payout_batches b
       where b.id = batch_id
         and public.pay_has_merchant_access(
           b.merchant_id,
           array['owner','admin','finance','developer','viewer']::text[]
         )
    )
  );

create or replace function public.pay_create_payout_batch(
  p_merchant_id uuid,
  p_asset text,
  p_token_mint text,
  p_token_program text,
  p_token_decimals integer,
  p_items jsonb,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text;
  v_wallet_count integer;
  v_wallet_address text;
  v_batch public.pay_payout_batches%rowtype;
  v_item jsonb;
  v_items jsonb;
  v_total numeric := 0;
  v_count integer;
  v_line integer := 0;
  v_existing public.pay_idempotency_keys%rowtype;
  v_response jsonb;
begin
  if current_setting('role', true) <> 'authenticated' then
    return jsonb_build_object('state','unauthorized');
  end if;

  v_user_id := public.pay_request_user_id();
  if v_user_id is null then return jsonb_build_object('state','unauthorized'); end if;

  if p_merchant_id is null
     or p_asset is null or p_asset not in ('SOL','USDC','USDT')
     or p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50
     or p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 1 or char_length(trim(p_idempotency_key)) > 255
     or p_request_hash is null or char_length(trim(p_request_hash)) < 1 then
    return jsonb_build_object('state','invalid');
  end if;

  if p_asset = 'SOL' and (p_token_mint is not null or p_token_program is not null or p_token_decimals is not null) then
    return jsonb_build_object('state','invalid');
  end if;
  if p_asset in ('USDC','USDT') and (
    p_token_mint is null
    or p_token_program <> 'spl-token'
    or p_token_decimals is null
    or p_token_decimals < 0
    or p_token_decimals > 255
  ) then
    return jsonb_build_object('state','invalid');
  end if;

  if not public.pay_has_merchant_access(
    p_merchant_id,
    array['owner','admin','finance']::text[]
  ) then
    return jsonb_build_object('state','forbidden');
  end if;

  if not exists (
    select 1 from public.pay_merchants m
     where m.id = p_merchant_id and m.status = 'active'
  ) then
    return jsonb_build_object('state','merchant_not_active');
  end if;

  select count(*), max(w.address)
    into v_wallet_count, v_wallet_address
    from public.pay_merchant_wallets w
   where w.merchant_id = p_merchant_id
     and w.wallet_role = 'receiving'
     and w.is_active = true
     and w.verification_status = 'verified';

  if v_wallet_count <> 1 or v_wallet_address is null then
    return jsonb_build_object('state','wallet_not_ready');
  end if;

  v_items := '[]'::jsonb;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object'
       or jsonb_typeof(v_item->'recipient') <> 'string'
       or jsonb_typeof(v_item->'amountAtomic') <> 'string'
       or char_length(trim(v_item->>'recipient')) < 32
       or char_length(trim(v_item->>'recipient')) > 44
       or trim(v_item->>'recipient') !~ '^[1-9A-HJ-NP-Za-km-z]+$'
       or trim(v_item->>'amountAtomic') !~ '^\d{1,78}$'
       or trim(v_item->>'amountAtomic')::numeric <= 0 then
      return jsonb_build_object('state','invalid');
    end if;

    v_line := v_line + 1;
    v_total := v_total + trim(v_item->>'amountAtomic')::numeric;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'recipient', trim(v_item->>'recipient'),
      'amountAtomic', trim(v_item->>'amountAtomic')
    ));
  end loop;

  v_count := jsonb_array_length(v_items);
  if v_count < 1 or v_count > 50 or v_total <= 0 or v_total >= power(10::numeric, 78) then
    return jsonb_build_object('state','invalid');
  end if;

  insert into public.pay_idempotency_keys(merchant_id,scope,idempotency_key,request_hash,status)
  values(p_merchant_id,'payout-batches:create',trim(p_idempotency_key),trim(p_request_hash),'processing')
  on conflict (merchant_id,scope,idempotency_key) do nothing
  returning * into v_existing;

  if not found then
    select * into v_existing from public.pay_idempotency_keys
     where merchant_id=p_merchant_id
       and scope='payout-batches:create'
       and idempotency_key=trim(p_idempotency_key)
     for update;
    if not found then return jsonb_build_object('state','error'); end if;
    if v_existing.request_hash <> trim(p_request_hash) then return jsonb_build_object('state','conflict'); end if;
    if v_existing.status='completed' and v_existing.response_body is not null then
      return jsonb_build_object('state','replay','response_body',v_existing.response_body,'response_status',coalesce(v_existing.response_status,201),'resource_id',v_existing.resource_id);
    end if;
    if v_existing.status='processing' then return jsonb_build_object('state','in_progress'); end if;
    return jsonb_build_object('state','error');
  end if;

  insert into public.pay_payout_batches(
    merchant_id,created_by_user_id,asset,token_mint,token_program,token_decimals,
    source_wallet_address,total_amount_atomic,item_count,status,verification_commitment
  ) values (
    p_merchant_id,v_user_id,p_asset,p_token_mint,p_token_program,p_token_decimals,
    v_wallet_address,v_total,v_count,'ready','finalized'
  )
  returning * into v_batch;

  v_line := 0;
  for v_item in select value from jsonb_array_elements(v_items) loop
    v_line := v_line + 1;
    insert into public.pay_payout_items(batch_id,line_number,recipient,amount_atomic,status)
    values(v_batch.id,v_line,trim(v_item->>'recipient'),trim(v_item->>'amountAtomic')::numeric,'ready');
  end loop;

  insert into public.pay_audit_logs(merchant_id,actor_user_id,event_type,entity_type,entity_id,request_id,metadata)
  values(
    p_merchant_id,v_user_id,'payout.batch.created','payout_batch',v_batch.id::text,null,
    jsonb_build_object('asset',v_batch.asset,'total_amount_atomic',v_batch.total_amount_atomic::text,'item_count',v_batch.item_count,'source_wallet_address',v_batch.source_wallet_address)
  );

  v_response := jsonb_build_object(
    'apiVersion','v1',
    'data',jsonb_build_object(
      'id',v_batch.id,
      'merchantId',v_batch.merchant_id,
      'createdByUserId',v_batch.created_by_user_id,
      'asset',v_batch.asset,
      'tokenMint',v_batch.token_mint,
      'tokenProgram',v_batch.token_program,
      'tokenDecimals',v_batch.token_decimals,
      'sourceWalletAddress',v_batch.source_wallet_address,
      'totalAmountAtomic',v_batch.total_amount_atomic::text,
      'itemCount',v_batch.item_count,
      'status',v_batch.status,
      'verificationCommitment',v_batch.verification_commitment,
      'transactionSignature',v_batch.transaction_signature,
      'transactionSlot',v_batch.transaction_slot,
      'transactionBlockTime',v_batch.transaction_block_time,
      'failureCode',v_batch.failure_code,
      'failureReason',v_batch.failure_reason,
      'verificationSummary',v_batch.verification_summary,
      'createdAt',v_batch.created_at,
      'updatedAt',v_batch.updated_at
    )
  );

  update public.pay_idempotency_keys
     set status='completed',response_status=201,response_body=v_response,resource_type='payout_batch',resource_id=v_batch.id,completed_at=now()
   where merchant_id=p_merchant_id and scope='payout-batches:create'
     and idempotency_key=trim(p_idempotency_key) and status='processing';
  if not found then raise exception 'payout batch idempotency completion failed'; end if;

  return jsonb_build_object('state','created','response_status',201,'response_body',v_response,'resource_id',v_batch.id);
exception
  when unique_violation then
    delete from public.pay_idempotency_keys
     where merchant_id=p_merchant_id and scope='payout-batches:create' and idempotency_key=trim(p_idempotency_key);
    return jsonb_build_object('state','conflict');
end;
$$;

revoke all on function public.pay_create_payout_batch(uuid,text,text,text,integer,jsonb,text,text) from public,anon;
grant execute on function public.pay_create_payout_batch(uuid,text,text,text,integer,jsonb,text,text) to authenticated;

create or replace function public.pay_submit_payout_batch(
  p_merchant_id uuid,
  p_batch_id uuid,
  p_signature text,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text;
  v_batch public.pay_payout_batches%rowtype;
  v_existing public.pay_idempotency_keys%rowtype;
  v_response jsonb;
begin
  if current_setting('role', true) <> 'authenticated' then return jsonb_build_object('state','unauthorized'); end if;
  v_user_id := public.pay_request_user_id();
  if v_user_id is null then return jsonb_build_object('state','unauthorized'); end if;

  if p_merchant_id is null or p_batch_id is null
     or p_signature is null or trim(p_signature) !~ '^[1-9A-HJ-NP-Za-km-z]{64,128}$'
     or p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 1 or char_length(trim(p_idempotency_key)) > 255
     or p_request_hash is null or char_length(trim(p_request_hash)) < 1 then
    return jsonb_build_object('state','invalid');
  end if;

  select * into v_batch from public.pay_payout_batches
   where id=p_batch_id and merchant_id=p_merchant_id
   for update;
  if not found then return jsonb_build_object('state','not_found'); end if;

  if not public.pay_has_merchant_access(p_merchant_id,array['owner','admin','finance']::text[]) then
    return jsonb_build_object('state','forbidden');
  end if;

  insert into public.pay_idempotency_keys(merchant_id,scope,idempotency_key,request_hash,status)
  values(p_merchant_id,'payout-batches:submit',trim(p_idempotency_key),trim(p_request_hash),'processing')
  on conflict (merchant_id,scope,idempotency_key) do nothing
  returning * into v_existing;

  if not found then
    select * into v_existing from public.pay_idempotency_keys
     where merchant_id=p_merchant_id and scope='payout-batches:submit' and idempotency_key=trim(p_idempotency_key)
     for update;
    if not found then return jsonb_build_object('state','error'); end if;
    if v_existing.request_hash <> trim(p_request_hash) then return jsonb_build_object('state','conflict'); end if;
    if v_existing.status='completed' and v_existing.response_body is not null then
      return jsonb_build_object('state','replay','response_body',v_existing.response_body,'response_status',coalesce(v_existing.response_status,200),'resource_id',v_existing.resource_id);
    end if;
    if v_existing.status='processing' then return jsonb_build_object('state','in_progress'); end if;
    return jsonb_build_object('state','error');
  end if;

  if v_batch.status not in ('ready','submitted','verifying') then
    delete from public.pay_idempotency_keys where id=v_existing.id;
    return jsonb_build_object('state','not_submitable','status',v_batch.status);
  end if;

  if v_batch.transaction_signature is not null and v_batch.transaction_signature <> trim(p_signature) then
    delete from public.pay_idempotency_keys where id=v_existing.id;
    return jsonb_build_object('state','signature_conflict');
  end if;

  update public.pay_payout_batches
     set transaction_signature=trim(p_signature),
         status=case when status='ready' then 'submitted' else status end,
         updated_at=now()
   where id=v_batch.id and merchant_id=v_batch.merchant_id
  returning * into v_batch;

  update public.pay_payout_items set status='submitted',updated_at=now()
   where batch_id=v_batch.id and status='ready';

  insert into public.pay_audit_logs(merchant_id,actor_user_id,event_type,entity_type,entity_id,request_id,metadata)
  values(v_batch.merchant_id,v_user_id,'payout.batch.submitted','payout_batch',v_batch.id::text,null,jsonb_build_object('signature',v_batch.transaction_signature));

  v_response := jsonb_build_object('apiVersion','v1','data',jsonb_build_object(
    'id',v_batch.id,'merchantId',v_batch.merchant_id,'createdByUserId',v_batch.created_by_user_id,
    'asset',v_batch.asset,'tokenMint',v_batch.token_mint,'tokenProgram',v_batch.token_program,'tokenDecimals',v_batch.token_decimals,
    'sourceWalletAddress',v_batch.source_wallet_address,'totalAmountAtomic',v_batch.total_amount_atomic::text,'itemCount',v_batch.item_count,
    'status',v_batch.status,'verificationCommitment',v_batch.verification_commitment,'transactionSignature',v_batch.transaction_signature,
    'transactionSlot',v_batch.transaction_slot,'transactionBlockTime',v_batch.transaction_block_time,'failureCode',v_batch.failure_code,
    'failureReason',v_batch.failure_reason,'verificationSummary',v_batch.verification_summary,'createdAt',v_batch.created_at,'updatedAt',v_batch.updated_at
  ));

  update public.pay_idempotency_keys set status='completed',response_status=202,response_body=v_response,resource_type='payout_batch',resource_id=v_batch.id,completed_at=now()
   where id=v_existing.id and status='processing';
  if not found then raise exception 'payout batch submit idempotency completion failed'; end if;

  return jsonb_build_object('state','submitted','response_status',202,'response_body',v_response,'resource_id',v_batch.id);
exception
  when unique_violation then
    delete from public.pay_idempotency_keys where merchant_id=p_merchant_id and scope='payout-batches:submit' and idempotency_key=trim(p_idempotency_key);
    return jsonb_build_object('state','signature_conflict');
end;
$$;

revoke all on function public.pay_submit_payout_batch(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.pay_submit_payout_batch(uuid,uuid,text,text,text) to authenticated;

create or replace function public.pay_apply_payout_verification(
  p_merchant_id uuid,
  p_batch_id uuid,
  p_signature text,
  p_status text,
  p_failure_code text,
  p_failure_reason text,
  p_slot bigint,
  p_block_time timestamptz,
  p_verification_summary jsonb,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id text;
  v_batch public.pay_payout_batches%rowtype;
begin
  if current_setting('role', true) <> 'authenticated' then return jsonb_build_object('state','unauthorized'); end if;
  v_user_id := public.pay_request_user_id();
  if v_user_id is null then return jsonb_build_object('state','unauthorized'); end if;
  if p_merchant_id is null or p_batch_id is null or p_signature is null
     or trim(p_signature) !~ '^[1-9A-HJ-NP-Za-km-z]{64,128}$'
     or p_status not in ('completed','failed') then
    return jsonb_build_object('state','invalid');
  end if;

  select * into v_batch from public.pay_payout_batches where id=p_batch_id and merchant_id=p_merchant_id for update;
  if not found then return jsonb_build_object('state','not_found'); end if;
  if not public.pay_has_merchant_access(p_merchant_id,array['owner','admin','finance']::text[]) then
    return jsonb_build_object('state','forbidden');
  end if;
  if v_batch.transaction_signature <> trim(p_signature) then return jsonb_build_object('state','signature_mismatch'); end if;

  if v_batch.status in ('completed','failed') then
    return jsonb_build_object('state','already_final','status',v_batch.status);
  end if;

  update public.pay_payout_batches
     set status=p_status,
         transaction_slot=p_slot,
         transaction_block_time=p_block_time,
         failure_code=case when p_status='failed' then nullif(trim(coalesce(p_failure_code,'')),'') else null end,
         failure_reason=case when p_status='failed' then nullif(trim(coalesce(p_failure_reason,'')),'') else null end,
         verification_summary=coalesce(p_verification_summary,'{}'::jsonb),
         updated_at=now()
   where id=v_batch.id;

  update public.pay_payout_items
     set status=case when p_status='completed' then 'completed' else 'failed' end,
         failure_code=case when p_status='failed' then nullif(trim(coalesce(p_failure_code,'')),'') else null end,
         failure_reason=case when p_status='failed' then nullif(trim(coalesce(p_failure_reason,'')),'') else null end,
         updated_at=now()
   where batch_id=v_batch.id;

  insert into public.pay_audit_logs(merchant_id,actor_user_id,event_type,entity_type,entity_id,request_id,metadata)
  values(v_batch.merchant_id,v_user_id,
    case when p_status='completed' then 'payout.batch.completed' else 'payout.batch.failed' end,
    'payout_batch',v_batch.id::text,p_request_id,
    jsonb_build_object('signature',trim(p_signature),'status',p_status,'failureCode',p_failure_code,'failureReason',p_failure_reason,'slot',p_slot,'blockTime',p_block_time,'verificationSummary',coalesce(p_verification_summary,'{}'::jsonb))
  );

  return jsonb_build_object('state','updated','status',p_status);
end;
$$;

revoke all on function public.pay_apply_payout_verification(uuid,uuid,text,text,text,text,bigint,timestamptz,jsonb,text) from public,anon;
grant execute on function public.pay_apply_payout_verification(uuid,uuid,text,text,text,text,bigint,timestamptz,jsonb,text) to authenticated;
