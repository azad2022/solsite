-- Count successful and failed delivery attempts consistently.
create or replace function public.pay_complete_webhook_delivery(
  p_delivery_id uuid,
  p_worker_id text,
  p_response_status integer,
  p_response_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.pay_webhook_deliveries
     set status = 'delivered',
         attempt_count = attempt_count + 1,
         delivered_at = now(),
         last_attempt_at = now(),
         response_status = p_response_status,
         response_hash = p_response_hash,
         error_code = null,
         locked_at = null,
         locked_by = null
   where id = p_delivery_id
     and status = 'delivering'
     and locked_by = p_worker_id;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return jsonb_build_object('ok', false, 'reason', 'STALE_DELIVERY_LEASE');
  end if;
  return jsonb_build_object('ok', true, 'status', 'delivered');
end;
$$;

revoke all on function public.pay_complete_webhook_delivery(uuid,text,integer,text) from public, anon, authenticated;
grant execute on function public.pay_complete_webhook_delivery(uuid,text,integer,text) to service_role;
