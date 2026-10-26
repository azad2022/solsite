-- Integration security checks for 20261026140000_solmint_pay_ticket_moderation_security.sql.
-- Run after the migration has been applied to this isolated fixture database.
INSERT INTO public.users (id, role, is_active) VALUES
  ('admin-1', 'admin', true),
  ('merchant-user-1', 'user', true),
  ('merchant-user-2', 'user', true);
INSERT INTO public.pay_merchants (id) VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO public.pay_merchant_members (merchant_id, user_id, status) VALUES
  ('11111111-1111-4111-8111-111111111111', 'merchant-user-1', 'active'),
  ('11111111-1111-4111-8111-111111111111', 'merchant-user-2', 'active');

DO $$
DECLARE
  v_merchant uuid := '11111111-1111-4111-8111-111111111111';
  v_ticket_one uuid;
  v_ticket_two uuid;
  v_admin_ticket uuid;
  v_deleted public.pay_tickets;
  v_payload text := '<script>alert(1)</script>''); DROP TABLE public.users; --';
  v_stored text;
  v_error text;
  v_block boolean;
  v_count integer;
BEGIN
  SELECT (public.pay_create_ticket(
    'merchant-user-1', v_merchant, 'Input encoding probe', v_payload, 'normal'
  )).id INTO v_ticket_one;

  SELECT m.body INTO v_stored
  FROM public.pay_ticket_messages m
  WHERE m.ticket_id = v_ticket_one
  ORDER BY m.created_at ASC
  LIMIT 1;
  IF v_stored IS DISTINCT FROM v_payload THEN
    RAISE EXCEPTION 'Ticket text was altered unexpectedly.';
  END IF;
  IF to_regclass('public.users') IS NULL OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = 'admin-1') THEN
    RAISE EXCEPTION 'Ticket input appears to have executed SQL rather than being stored as data.';
  END IF;

  SELECT (public.pay_create_ticket(
    'merchant-user-2', v_merchant, 'Blocked user lifecycle', 'Please review my account', 'normal'
  )).id INTO v_ticket_two;

  PERFORM public.pay_block_ticket_user('admin-1', v_ticket_two, 'Repeated spam');
  IF NOT EXISTS (SELECT 1 FROM public.pay_ticket_user_blocks WHERE user_id = 'merchant-user-2') THEN
    RAISE EXCEPTION 'Block RPC did not persist the support block.';
  END IF;

  BEGIN
    PERFORM public.pay_create_ticket('merchant-user-2', v_merchant, 'Blocked create', 'Another request', 'normal');
    RAISE EXCEPTION 'Expected blocked user ticket creation to fail.';
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    IF v_error <> 'TICKET_USER_BLOCKED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.pay_add_ticket_message('merchant-user-2', v_ticket_two, 'A blocked reply');
    RAISE EXCEPTION 'Expected blocked user reply to fail.';
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    IF v_error <> 'TICKET_USER_BLOCKED' THEN RAISE; END IF;
  END;

  SELECT * INTO v_deleted
  FROM public.pay_soft_delete_ticket('admin-1', v_ticket_two);
  IF v_deleted.id IS DISTINCT FROM v_ticket_two OR v_deleted.deleted_at IS NULL OR v_deleted.deleted_by_user_id <> 'admin-1' THEN
    RAISE EXCEPTION 'Soft delete did not mark the ticket or record its administrator.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pay_ticket_messages WHERE ticket_id = v_ticket_two) THEN
    RAISE EXCEPTION 'Soft delete must preserve the ticket conversation.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pay_audit_logs WHERE event_type = 'ticket.deleted' AND entity_id = v_ticket_two::text) THEN
    RAISE EXCEPTION 'Soft delete audit event is missing.';
  END IF;

  v_block := public.pay_unblock_ticket_user_by_id('admin-1', 'merchant-user-2');
  IF NOT v_block OR EXISTS (SELECT 1 FROM public.pay_ticket_user_blocks WHERE user_id = 'merchant-user-2') THEN
    RAISE EXCEPTION 'A blocked user could not be unblocked after the ticket was deleted.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pay_audit_logs WHERE event_type = 'ticket.user_unblocked' AND entity_id = 'merchant-user-2') THEN
    RAISE EXCEPTION 'User unblock audit event is missing.';
  END IF;

  INSERT INTO public.pay_tickets (merchant_id, created_by_user_id, subject, status, priority)
  VALUES (v_merchant, 'admin-1', 'Admin account protection', 'open', 'normal')
  RETURNING id INTO v_admin_ticket;

  BEGIN
    PERFORM public.pay_block_ticket_user('admin-1', v_admin_ticket, 'Protect administrators');
    RAISE EXCEPTION 'Expected administrator blocking to fail.';
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    IF v_error <> 'ADMIN_USER_CANNOT_BE_BLOCKED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.pay_soft_delete_ticket('merchant-user-1', v_ticket_one);
    RAISE EXCEPTION 'Expected non-admin deletion to fail.';
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    IF v_error <> 'FORBIDDEN' THEN RAISE; END IF;
  END;

  IF has_table_privilege('anon', 'public.pay_ticket_user_blocks', 'SELECT')
     OR has_table_privilege('authenticated', 'public.pay_ticket_user_blocks', 'SELECT') THEN
    RAISE EXCEPTION 'Direct read access to ticket block records must remain restricted.';
  END IF;
  IF has_function_privilege('authenticated', 'public.pay_soft_delete_ticket(text,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.pay_block_ticket_user(text,uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.pay_soft_delete_ticket(text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Ticket moderation RPC grants are not restricted to service_role.';
  END IF;
END;
$$;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'merchant-user-1', true);
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.pay_tickets WHERE id = '00000000-0000-0000-0000-000000000000';
  IF v_count <> 0 THEN RAISE EXCEPTION 'Unexpected RLS row for a missing ticket.'; END IF;

  SELECT count(*) INTO v_count
  FROM public.pay_tickets
  WHERE created_by_user_id = 'admin-1';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Merchant member should only see tickets for their merchant and no deleted tickets.'; END IF;

  SELECT count(*) INTO v_count
  FROM public.pay_tickets
  WHERE deleted_at IS NOT NULL;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Deleted tickets must be hidden by RLS.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.pay_ticket_messages m
  JOIN public.pay_tickets t ON t.id = m.ticket_id
  WHERE t.deleted_at IS NOT NULL;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Messages from deleted tickets must be hidden by RLS.';
  END IF;
END;
$$;
RESET ROLE;
COMMIT;
