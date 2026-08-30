-- Atomic idempotency reservation for financial/business mutations.
-- The caller must not implement reservation as a read-then-write sequence.

create or replace function public.pay_reserve_idempotency(
  p_merchant_id uuid,
  p_scope text,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pay_idempotency_keys%rowtype;
begin
  if p_merchant_id is null or p_scope is null or p_scope = '' or
     p_idempotency_key is null or p_idempotency_key = '' or
     p_request_hash is null or p_request_hash = '' then
    raise exception 'invalid idempotency input';
  end if;

  select * into v_row
    from public.pay_idempotency_keys
   where merchant_id = p_merchant_id
     and scope = p_scope
     and idempotency_key = p_idempotency_key
   for update;

  if not found then
    insert into public.pay_idempotency_keys (
      merchant_id, scope, idempotency_key, request_hash, status
    ) values (
      p_merchant_id, p_scope, p_idempotency_key, p_request_hash, 'processing'
    )
    returning * into v_row;

    return jsonb_build_object(
      'state', 'reserved',
      'resource_id', v_row.id
    );
  end if;

  if v_row.request_hash <> p_request_hash then
    return jsonb_build_object('state', 'conflict');
  end if;

  if v_row.status = 'completed' and v_row.response_body is not null then
    return jsonb_build_object(
      'state', 'replay',
      'response_status', coalesce(v_row.response_status, 200),
      'response_body', v_row.response_body,
      'resource_id', v_row.resource_id
    );
  end if;

  if v_row.status = 'failed' then
    update public.pay_idempotency_keys
       set status = 'processing',
           response_status = null,
           response_body = null,
           resource_type = null,
           resource_id = null,
           completed_at = null
     where id = v_row.id
    returning * into v_row;

    return jsonb_build_object(
      'state', 'reserved',
      'resource_id', v_row.id
    );
  end if;

  return jsonb_build_object('state', 'in_progress');
end;
$$;

revoke all on function public.pay_reserve_idempotency(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.pay_reserve_idempotency(uuid, text, text, text) to service_role;

comment on function public.pay_reserve_idempotency(uuid, text, text, text) is 'Atomic merchant-scoped idempotency reservation for Pay mutations. Server-only.';
