-- SolMint Pay API credentials
-- Contract boundary: only the server creates, revokes, or rotates bearer keys.
-- Plaintext key material is never persisted. It is returned only by the server
-- on the initial successful mutation response; idempotent replays return metadata
-- without the secret so the database never needs a reversible secret store.

create or replace function public.pay_create_api_key(
  p_actor_user_id text,
  p_merchant_id uuid,
  p_name text,
  p_key_prefix text,
  p_key_hash text,
  p_scopes text[],
  p_expires_at timestamptz default null,
  p_idempotency_key text default null,
  p_request_hash text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_merchant public.pay_merchants%rowtype;
  v_key public.pay_api_keys%rowtype;
  v_existing_id uuid;
  v_existing_status text;
  v_existing_hash text;
  v_existing_body jsonb;
  v_body jsonb;
begin
  if nullif(btrim(p_actor_user_id), '') is null or p_merchant_id is null or p_idempotency_key is null or p_request_hash is null then
    return jsonb_build_object('state','invalid','reason','INVALID_INPUT');
  end if;
  if length(p_name) < 1 or length(p_name) > 120 then return jsonb_build_object('state','invalid','reason','INVALID_NAME'); end if;
  if p_key_prefix is null or length(p_key_prefix) < 8 or length(p_key_prefix) > 32 then return jsonb_build_object('state','invalid','reason','INVALID_PREFIX'); end if;
  if p_key_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('state','invalid','reason','INVALID_HASH'); end if;
  if p_expires_at is not null and p_expires_at <= now() then return jsonb_build_object('state','invalid','reason','INVALID_EXPIRY'); end if;
  if p_scopes is null or p_scopes <> array['payment.create']::text[] then return jsonb_build_object('state','invalid','reason','INVALID_SCOPES'); end if;

  select m.* into v_merchant from public.pay_merchants m where m.id=p_merchant_id for update;
  if v_merchant.id is null then return jsonb_build_object('state','forbidden','reason','MERCHANT_NOT_FOUND'); end if;
  if not exists (
    select 1 from public.users u join public.pay_merchant_members mm on mm.user_id=u.id
     where u.id=p_actor_user_id and u.is_active=true and mm.merchant_id=p_merchant_id and mm.status='active' and mm.role='owner'
  ) then return jsonb_build_object('state','forbidden','reason','MERCHANT_FORBIDDEN'); end if;
  if v_merchant.status <> 'active' then return jsonb_build_object('state','forbidden','reason','MERCHANT_NOT_ACTIVE'); end if;

  select id,status,request_hash,response_body into v_existing_id,v_existing_status,v_existing_hash,v_existing_body
    from public.pay_idempotency_keys where merchant_id=p_merchant_id and scope='api-keys:create' and idempotency_key=p_idempotency_key for update;
  if v_existing_id is not null then
    if v_existing_hash <> p_request_hash then return jsonb_build_object('state','conflict','reason','IDEMPOTENCY_CONFLICT'); end if;
    if v_existing_status='processing' then return jsonb_build_object('state','in_progress'); end if;
    if v_existing_status='completed' then return jsonb_build_object('state','replay','response_status',coalesce((v_existing_body->>'responseStatus')::integer,200),'response_body',v_existing_body-'responseStatus'); end if;
  end if;

  if v_existing_id is null then
    insert into public.pay_idempotency_keys(merchant_id,scope,idempotency_key,request_hash,status,resource_type)
    values(p_merchant_id,'api-keys:create',p_idempotency_key,p_request_hash,'processing','api_key')
    returning id into v_existing_id;
  end if;

  insert into public.pay_api_keys(merchant_id,name,key_prefix,key_hash,scopes,expires_at)
  values(p_merchant_id,p_name,p_key_prefix,p_key_hash,p_scopes,p_expires_at) returning * into v_key;

  v_body:=jsonb_build_object('apiKey',jsonb_build_object('id',v_key.id,'merchantId',v_key.merchant_id,'name',v_key.name,'keyPrefix',v_key.key_prefix,'scopes',v_key.scopes,'expiresAt',v_key.expires_at,'revokedAt',v_key.revoked_at,'lastUsedAt',v_key.last_used_at,'createdAt',v_key.created_at),'responseStatus',201);
  update public.pay_idempotency_keys set status='completed',response_status=201,response_body=v_body,resource_id=v_key.id,completed_at=now() where id=v_existing_id;
  insert into public.pay_audit_logs(merchant_id,actor_user_id,event_type,entity_type,entity_id,metadata,created_at)
  values(p_merchant_id,p_actor_user_id,'api_key.created','api_key',v_key.id::text,jsonb_build_object('keyPrefix',v_key.key_prefix,'scopes',v_key.scopes,'expiresAt',v_key.expires_at),now());
  return jsonb_build_object('state','created','response_status',201,'response_body',v_body-'responseStatus');
end; $$;

create or replace function public.pay_revoke_api_key(p_actor_user_id text,p_merchant_id uuid,p_key_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_key public.pay_api_keys%rowtype;
begin
  if p_actor_user_id is null or p_merchant_id is null or p_key_id is null then return jsonb_build_object('state','invalid','reason','INVALID_INPUT'); end if;
  if not exists (select 1 from public.users u join public.pay_merchant_members mm on mm.user_id=u.id where u.id=p_actor_user_id and u.is_active=true and mm.merchant_id=p_merchant_id and mm.status='active' and mm.role='owner') then return jsonb_build_object('state','forbidden','reason','MERCHANT_FORBIDDEN'); end if;
  select * into v_key from public.pay_api_keys where id=p_key_id and merchant_id=p_merchant_id for update;
  if v_key.id is null then return jsonb_build_object('state','not_found','reason','API_KEY_NOT_FOUND'); end if;
  if v_key.revoked_at is null then
    update public.pay_api_keys set revoked_at=now() where id=v_key.id returning * into v_key;
    insert into public.pay_audit_logs(merchant_id,actor_user_id,event_type,entity_type,entity_id,metadata,created_at)
    values(p_merchant_id,p_actor_user_id,'api_key.revoked','api_key',v_key.id::text,jsonb_build_object('keyPrefix',v_key.key_prefix),now());
  end if;
  return jsonb_build_object('state','revoked','apiKey',jsonb_build_object('id',v_key.id,'merchantId',v_key.merchant_id,'name',v_key.name,'keyPrefix',v_key.key_prefix,'scopes',v_key.scopes,'expiresAt',v_key.expires_at,'revokedAt',v_key.revoked_at,'lastUsedAt',v_key.last_used_at,'createdAt',v_key.created_at));
end; $$;

create or replace function public.pay_rotate_api_key(
  p_actor_user_id text,p_merchant_id uuid,p_key_id uuid,p_name text,p_key_prefix text,p_key_hash text,p_scopes text[],p_expires_at timestamptz default null,p_idempotency_key text default null,p_request_hash text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_key public.pay_api_keys%rowtype;
  v_new_key public.pay_api_keys%rowtype;
  v_existing_id uuid;
  v_existing_status text;
  v_existing_hash text;
  v_existing_body jsonb;
  v_body jsonb;
begin
  if p_actor_user_id is null or p_merchant_id is null or p_key_id is null or p_idempotency_key is null or p_request_hash is null then return jsonb_build_object('state','invalid','reason','INVALID_INPUT'); end if;
  if length(p_name)<1 or length(p_name)>120 or p_key_prefix is null or length(p_key_prefix)<8 or length(p_key_prefix)>32 then return jsonb_build_object('state','invalid','reason','INVALID_INPUT'); end if;
  if p_key_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('state','invalid','reason','INVALID_HASH'); end if;
  if p_expires_at is not null and p_expires_at<=now() then return jsonb_build_object('state','invalid','reason','INVALID_EXPIRY'); end if;
  if p_scopes is null or p_scopes<>array['payment.create']::text[] then return jsonb_build_object('state','invalid','reason','INVALID_SCOPES'); end if;
  if not exists (select 1 from public.users u join public.pay_merchant_members mm on mm.user_id=u.id where u.id=p_actor_user_id and u.is_active=true and mm.merchant_id=p_merchant_id and mm.status='active' and mm.role='owner') then return jsonb_build_object('state','forbidden','reason','MERCHANT_FORBIDDEN'); end if;
  select * into v_key from public.pay_api_keys where id=p_key_id and merchant_id=p_merchant_id for update;
  if v_key.id is null then return jsonb_build_object('state','not_found','reason','API_KEY_NOT_FOUND'); end if;
  if v_key.revoked_at is not null then return jsonb_build_object('state','invalid','reason','API_KEY_REVOKED'); end if;
  select id,status,request_hash,response_body into v_existing_id,v_existing_status,v_existing_hash,v_existing_body from public.pay_idempotency_keys where merchant_id=p_merchant_id and scope='api-keys:rotate' and idempotency_key=p_idempotency_key for update;
  if v_existing_id is not null then
    if v_existing_hash<>p_request_hash then return jsonb_build_object('state','conflict','reason','IDEMPOTENCY_CONFLICT'); end if;
    if v_existing_status='processing' then return jsonb_build_object('state','in_progress'); end if;
    if v_existing_status='completed' then return jsonb_build_object('state','replay','response_status',200,'response_body',v_existing_body-'responseStatus'); end if;
  end if;
  if v_existing_id is null then
    insert into public.pay_idempotency_keys(merchant_id,scope,idempotency_key,request_hash,status,resource_type,resource_id)
    values(p_merchant_id,'api-keys:rotate',p_idempotency_key,p_request_hash,'processing','api_key',v_key.id) returning id into v_existing_id;
  end if;
  update public.pay_api_keys set revoked_at=now() where id=v_key.id returning * into v_key;
  insert into public.pay_api_keys(merchant_id,name,key_prefix,key_hash,scopes,expires_at) values(p_merchant_id,p_name,p_key_prefix,p_key_hash,p_scopes,p_expires_at) returning * into v_new_key;
  v_body:=jsonb_build_object('apiKey',jsonb_build_object('id',v_new_key.id,'merchantId',v_new_key.merchant_id,'name',v_new_key.name,'keyPrefix',v_new_key.key_prefix,'scopes',v_new_key.scopes,'expiresAt',v_new_key.expires_at,'revokedAt',v_new_key.revoked_at,'lastUsedAt',v_new_key.last_used_at,'createdAt',v_new_key.created_at),'replacedKeyId',v_key.id,'responseStatus',201);
  update public.pay_idempotency_keys set status='completed',response_status=201,response_body=v_body,resource_id=v_new_key.id,completed_at=now() where id=v_existing_id;
  insert into public.pay_audit_logs(merchant_id,actor_user_id,event_type,entity_type,entity_id,metadata,created_at) values(p_merchant_id,p_actor_user_id,'api_key.rotated','api_key',v_new_key.id::text,jsonb_build_object('keyPrefix',v_new_key.key_prefix,'replacedKeyId',v_key.id::text,'scopes',v_new_key.scopes,'expiresAt',v_new_key.expires_at),now());
  return jsonb_build_object('state','created','response_status',201,'response_body',v_body-'responseStatus');
exception when unique_violation then return jsonb_build_object('state','conflict','reason','API_KEY_UNIQUE_CONFLICT');
end; $$;

revoke all on function public.pay_create_api_key(text,uuid,text,text,text,text[],timestamptz,text,text) from public,anon,authenticated;
revoke all on function public.pay_revoke_api_key(text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.pay_rotate_api_key(text,uuid,uuid,text,text,text,text[],timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.pay_create_api_key(text,uuid,text,text,text,text[],timestamptz,text,text) to service_role;
grant execute on function public.pay_revoke_api_key(text,uuid,uuid) to service_role;
grant execute on function public.pay_rotate_api_key(text,uuid,uuid,text,text,text,text[],timestamptz,text,text) to service_role;
