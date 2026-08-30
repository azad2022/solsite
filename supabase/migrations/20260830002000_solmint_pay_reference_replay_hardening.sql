-- Reference/replay hardening for SolMint Pay.
-- This migration is intentionally not executed in production until the Pay release gates pass.

create or replace function public.pay_apply_verified_observation(
  p_payment_id uuid,
  p_signature text,
  p_slot bigint,
  p_block_time timestamptz,
  p_observed_amount_atomic numeric,
  p_asset text,
  p_recipient text,
  p_reference_matched boolean,
  p_success boolean,
  p_commitment text,
  p_fee_payer text,
  p_network_fee_lamports numeric,
  p_transfers jsonb,
  p_raw_observation jsonb default '{}'::jsonb,
  p_verified_at timestamptz default now(),
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.pay_payment_transactions%rowtype;
  v_payment public.pay_payment_intents%rowtype;
begin
  select * into v_payment from public.pay_payment_intents where id = p_payment_id for update;
  if v_payment.id is null then return jsonb_build_object('ok', false, 'reason', 'PAYMENT_NOT_FOUND'); end if;

  select * into v_existing from public.pay_payment_transactions where signature = p_signature;
  if v_existing.id is not null then
    if v_existing.payment_id <> p_payment_id then
      return jsonb_build_object('ok', false, 'reason', 'SIGNATURE_ALREADY_BOUND');
    end if;
    if v_existing.is_authoritative then
      return jsonb_build_object('ok', false, 'reason', 'ALREADY_AUTHORIZED');
    end if;
    if v_existing.verification_status = 'rejected' then
      return jsonb_build_object('ok', false, 'reason', 'SIGNATURE_PREVIOUSLY_REJECTED');
    end if;
  end if;

  return jsonb_build_object('ok', false, 'reason', 'REQUIRES_BASE_IMPLEMENTATION');
end;
$$;

-- The wrapper above deliberately fails closed. The canonical implementation remains
-- the previously reviewed atomic function; the release pipeline must reject this
-- migration until the implementation is composed from that canonical body plus the
-- additional replay guard. Keeping this migration explicit prevents accidental
-- deployment of a partially merged function.

revoke all on function public.pay_apply_verified_observation(uuid,text,bigint,timestamptz,numeric,text,text,boolean,boolean,text,text,numeric,jsonb,jsonb,timestamptz,text) from public, anon, authenticated;
grant execute on function public.pay_apply_verified_observation(uuid,text,bigint,timestamptz,numeric,text,text,boolean,boolean,text,text,numeric,jsonb,jsonb,timestamptz,text) to service_role;
