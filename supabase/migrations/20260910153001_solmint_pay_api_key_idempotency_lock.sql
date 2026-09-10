-- Serialize API-key create/rotate on the same merchant + idempotency key.
-- The existing lifecycle functions contain the authoritative mutation logic; these
-- wrappers add transaction-scoped advisory locking without duplicating that logic.

alter function public.pay_create_api_key(text,uuid,text,text,text,text[],timestamptz,text,text)
  rename to pay_create_api_key_unlocked;
alter function public.pay_rotate_api_key(text,uuid,uuid,text,text,text,text[],timestamptz,text,text)
  rename to pay_rotate_api_key_unlocked;

revoke all on function public.pay_create_api_key_unlocked(text,uuid,text,text,text,text[],timestamptz,text,text) from public, anon, authenticated, service_role;
revoke all on function public.pay_rotate_api_key_unlocked(text,uuid,uuid,text,text,text,text[],timestamptz,text,text) from public, anon, authenticated, service_role;

create function public.pay_create_api_key(
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
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'solmint-pay:api-key:create:' || coalesce(p_merchant_id::text, '') || ':' || coalesce(p_idempotency_key, ''),
    0
  ));
  return public.pay_create_api_key_unlocked(
    p_actor_user_id, p_merchant_id, p_name, p_key_prefix, p_key_hash,
    p_scopes, p_expires_at, p_idempotency_key, p_request_hash
  );
end;
$$;

create function public.pay_rotate_api_key(
  p_actor_user_id text,
  p_merchant_id uuid,
  p_key_id uuid,
  p_name text,
  p_key_prefix text,
  p_key_hash text,
  p_scopes text[],
  p_expires_at timestamptz default null,
  p_idempotency_key text default null,
  p_request_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'solmint-pay:api-key:rotate:' || coalesce(p_merchant_id::text, '') || ':' || coalesce(p_idempotency_key, ''),
    0
  ));
  return public.pay_rotate_api_key_unlocked(
    p_actor_user_id, p_merchant_id, p_key_id, p_name, p_key_prefix, p_key_hash,
    p_scopes, p_expires_at, p_idempotency_key, p_request_hash
  );
end;
$$;

revoke all on function public.pay_create_api_key(text,uuid,text,text,text,text[],timestamptz,text,text) from public, anon, authenticated;
revoke all on function public.pay_rotate_api_key(text,uuid,uuid,text,text,text,text[],timestamptz,text,text) from public, anon, authenticated;
grant execute on function public.pay_create_api_key(text,uuid,text,text,text,text[],timestamptz,text,text) to service_role;
grant execute on function public.pay_rotate_api_key(text,uuid,uuid,text,text,text,text[],timestamptz,text,text) to service_role;
