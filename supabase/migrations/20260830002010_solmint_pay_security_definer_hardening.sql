-- Security-definer hardening.
-- Supabase recommends an empty search_path for SECURITY DEFINER functions so
-- object resolution cannot be influenced by session-level search-path state.

alter function public.pay_check_and_increment_rate_limit(text,text,integer,integer,timestamptz)
  set search_path = '';

alter function public.pay_create_payment_intent(uuid,text,numeric,text,text,text,integer,text,text,integer,text,numeric,numeric,numeric,text,text,timestamptz,jsonb,text,text,text)
  set search_path = '';

alter function public.pay_transition_payment(uuid,text,text,text)
  set search_path = '';

alter function public.pay_record_rejected_observation(uuid,text,bigint,timestamptz,boolean,text,text,numeric,text,text,boolean,text,jsonb)
  set search_path = '';

alter function public.pay_apply_verified_observation(uuid,text,bigint,timestamptz,numeric,text,text,boolean,boolean,text,text,numeric,jsonb,jsonb,timestamptz,text)
  set search_path = '';

comment on function public.pay_apply_verified_observation(uuid,text,bigint,timestamptz,numeric,text,text,boolean,boolean,text,text,numeric,jsonb,jsonb,timestamptz,text)
is 'Server-only atomic Pay reconciliation. SECURITY DEFINER search_path is intentionally empty.';
