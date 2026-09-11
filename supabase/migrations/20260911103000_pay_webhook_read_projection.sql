create or replace function public.pay_read_webhooks(
  p_merchant_id uuid,
  p_webhook_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id text;
  v_webhooks jsonb;
  v_deliveries jsonb := '[]'::jsonb;
begin
  if current_setting('role', true) <> 'authenticated' then
    return jsonb_build_object('authorized', false, 'code', 'UNAUTHORIZED');
  end if;
  if p_merchant_id is null or p_limit is null or p_limit < 1 or p_limit > 100 then
    return jsonb_build_object('authorized', false, 'code', 'INVALID_ARGUMENT');
  end if;
  v_user_id := public.pay_request_user_id();
  if v_user_id is null then return jsonb_build_object('authorized', false, 'code', 'UNAUTHORIZED'); end if;
  if not exists (
    select 1 from public.pay_merchant_members m
    where m.merchant_id = p_merchant_id and m.user_id = v_user_id and m.status = 'active'
  ) then return jsonb_build_object('authorized', false, 'code', 'FORBIDDEN'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', w.id, 'merchant_id', w.merchant_id, 'endpoint_url', w.endpoint_url, 'active', w.active,
    'subscribed_events', w.subscribed_events, 'created_at', w.created_at, 'updated_at', w.updated_at,
    'status', w.status, 'failure_count', w.failure_count, 'disabled_at', w.disabled_at,
    'secret_configured', (w.secret_hash is not null or w.encrypted_secret is not null or w.secret_ciphertext is not null or w.signing_secret_ciphertext is not null),
    'signature_status', case when (w.secret_hash is not null or w.encrypted_secret is not null or w.secret_ciphertext is not null or w.signing_secret_ciphertext is not null) then 'server_signed' else 'not_configured' end
  ) order by w.created_at desc), '[]'::jsonb)
  into v_webhooks
  from (select * from public.pay_webhooks where merchant_id = p_merchant_id and (p_webhook_id is null or id = p_webhook_id) order by created_at desc limit p_limit) w;

  if p_webhook_id is not null and jsonb_array_length(v_webhooks) = 1 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id, 'webhook_id', d.webhook_id, 'event_id', d.event_id, 'event_type', d.event_type,
      'attempt_count', d.attempt_count, 'status', d.status, 'next_attempt_at', d.next_attempt_at,
      'last_attempt_at', d.last_attempt_at, 'delivered_at', d.delivered_at, 'created_at', d.created_at,
      'response_status', d.response_status, 'response_hash', d.response_hash, 'error_code', d.error_code
    ) order by d.created_at desc), '[]'::jsonb)
    into v_deliveries
    from (select * from public.pay_webhook_deliveries where webhook_id = p_webhook_id order by created_at desc limit p_limit) d;
  end if;

  return jsonb_build_object('authorized', true, 'webhooks', v_webhooks, 'deliveries', v_deliveries);
end;
$$;
revoke all on function public.pay_read_webhooks(uuid, uuid, integer) from public, anon;
grant execute on function public.pay_read_webhooks(uuid, uuid, integer) to authenticated;
