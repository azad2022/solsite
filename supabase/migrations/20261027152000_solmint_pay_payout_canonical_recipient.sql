begin;

-- Validate the decoded byte length of a Base58-encoded Solana public key.
-- Valid addresses are exactly 32 decoded bytes; alphabet/length checks alone are insufficient.
create or replace function public.pay_is_canonical_solana_address(p_address text)
returns boolean
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_alphabet constant text := '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  v_leading_ones integer := 0;
  v_byte_length integer := 0;
  v_index integer;
  v_digit integer;
  v_value numeric := 0;
begin
  if p_address is null
     or char_length(p_address) not between 32 and 44
     or p_address !~ '^[1-9A-HJ-NP-Za-km-z]+$' then
    return false;
  end if;

  while v_leading_ones < char_length(p_address)
    and substr(p_address, v_leading_ones + 1, 1) = '1' loop
    v_leading_ones := v_leading_ones + 1;
  end loop;

  for v_index in (v_leading_ones + 1)..char_length(p_address) loop
    v_digit := strpos(v_alphabet, substr(p_address, v_index, 1)) - 1;
    if v_digit < 0 then return false; end if;
    v_value := v_value * 58 + v_digit;
  end loop;

  while v_value > 0 loop
    v_value := trunc(v_value / 256);
    v_byte_length := v_byte_length + 1;
  end loop;

  return v_leading_ones + v_byte_length = 32;
end;
$function$;

revoke all on function public.pay_is_canonical_solana_address(text) from public, anon, authenticated;

-- Close direct authenticated RPC bypasses: only the server-issued payout-creator capability may create a batch.
-- Also reject native SOL amounts the current transaction builder cannot represent safely as lamports.
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
  if current_setting('role',true) <> 'authenticated'
     or coalesce(auth.jwt()->>'solmint_pay_payout_creator','') <> 'true' then
    return jsonb_build_object('state','unauthorized');
  end if;
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
       or not public.pay_is_canonical_solana_address(trim(v_item->>'recipient'))
       or trim(v_item->>'amountAtomic') !~ '^[0-9]{1,78}$'
       or trim(v_item->>'amountAtomic')::numeric <= 0 then
      return jsonb_build_object('state','invalid');
    end if;
    if p_asset='SOL' and trim(v_item->>'amountAtomic')::numeric > 9007199254740991::numeric then
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

commit;
