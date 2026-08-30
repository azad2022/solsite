-- Keep database payment lifecycle identical to the TypeScript state machine.
-- This migration supersedes the transition function created earlier and pins
-- SECURITY DEFINER execution to an empty search_path.

create or replace function public.pay_transition_payment(
  p_payment_id uuid,
  p_to_status text,
  p_reason text default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text;
  v_allowed boolean := false;
begin
  select status into v_from
    from public.pay_payment_intents
   where id = p_payment_id
   for update;

  if v_from is null then
    return jsonb_build_object('ok', false, 'reason', 'PAYMENT_NOT_FOUND');
  end if;

  v_allowed := case
    when v_from = 'created' and p_to_status in ('pending','expired') then true
    when v_from = 'pending' and p_to_status in ('detected','expired','failed') then true
    when v_from = 'detected' and p_to_status in ('verifying','underpaid','overpaid','wrong_token','wrong_recipient','duplicate','failed') then true
    when v_from = 'verifying' and p_to_status in ('pending','confirmed','underpaid','overpaid','wrong_token','wrong_recipient','duplicate','failed') then true
    when v_from = 'underpaid' and p_to_status in ('pending','detected','verifying','expired') then true
    when v_from = 'overpaid' and p_to_status in ('refunded','completed') then true
    when v_from = 'confirmed' and p_to_status in ('completed','refunded') then true
    when v_from = 'completed' and p_to_status = 'refunded' then true
    else false
  end;

  if not v_allowed then
    return jsonb_build_object('ok', false, 'reason', 'ILLEGAL_TRANSITION', 'from', v_from, 'to', p_to_status);
  end if;

  update public.pay_payment_intents
     set status = p_to_status,
         updated_at = now()
   where id = p_payment_id;

  insert into public.pay_payment_events(
    payment_id, event_type, from_status, to_status, request_id, actor_type, payload
  ) values (
    p_payment_id,
    'payment.status_changed',
    v_from,
    p_to_status,
    p_request_id,
    'system',
    jsonb_build_object('reason', p_reason)
  );

  return jsonb_build_object('ok', true, 'from', v_from, 'to', p_to_status);
end;
$$;

revoke all on function public.pay_transition_payment(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.pay_transition_payment(uuid, text, text, text) to service_role;
