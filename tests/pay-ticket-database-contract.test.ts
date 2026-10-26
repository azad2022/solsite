import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('Ticket read contract grants authenticated SELECT while keeping mutations server-mediated', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migrations/20261001184500_solmint_pay_support_tickets_select_grants.sql', import.meta.url),
    'utf8',
  );

  assert.match(
    migration,
    /grant\s+select\s+on\s+table\s+public\.pay_tickets\s*,\s*public\.pay_ticket_messages\s+to\s+authenticated\s*;/i,
  );
  assert.doesNotMatch(migration, /grant\s+(?:all|insert|update|delete)\s+on\s+table/i);
});


test('ticket moderation migration soft-deletes, audits, and blocks support interactions server-side', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migrations/20261026090718_solmint_pay_ticket_moderation_security.sql', import.meta.url),
    'utf8',
  );
  assert.ok(migration.includes('add column if not exists deleted_at timestamptz'));
  assert.ok(migration.includes('function public.pay_soft_delete_ticket'));
  assert.ok(migration.includes('ticket.deleted'));
  assert.equal(migration.toLowerCase().includes('delete from public.pay_tickets'), false);
  assert.ok(migration.includes('create table if not exists public.pay_ticket_user_blocks'));
  assert.ok(migration.includes('TICKET_USER_BLOCKED'));
  assert.ok(migration.includes('function public.pay_block_ticket_user'));
  assert.ok(migration.includes('function public.pay_unblock_ticket_user'));
  assert.ok(migration.includes('alter table public.pay_ticket_user_blocks enable row level security'));
  assert.ok(migration.includes('revoke all on table public.pay_ticket_user_blocks from public, anon, authenticated'));
  assert.ok(migration.includes('grant execute on function public.pay_soft_delete_ticket(text, uuid) to service_role'));
});


test('ticket support can unblock a user after their only ticket was soft-deleted', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migrations/20261026090718_solmint_pay_ticket_moderation_security.sql', import.meta.url),
    'utf8',
  );
  assert.ok(migration.includes('function public.pay_unblock_ticket_user_by_id'));
  assert.ok(migration.includes("'source', 'blocked_users_list'"));
  assert.ok(migration.includes('grant execute on function public.pay_unblock_ticket_user_by_id(text, text) to service_role'));
});


test('ticket SECURITY DEFINER RPCs use an empty search_path in the production hardening migration', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migrations/20261026091519_solmint_pay_ticket_moderation_search_path_hardening.sql', import.meta.url),
    'utf8',
  );
  const functions = [
    'pay_create_ticket(text, uuid, text, text, text)',
    'pay_add_ticket_message(text, uuid, text)',
    'pay_update_ticket_status(text, uuid, text)',
    'pay_soft_delete_ticket(text, uuid)',
    'pay_block_ticket_user(text, uuid, text)',
    'pay_unblock_ticket_user(text, uuid)',
    'pay_unblock_ticket_user_by_id(text, text)',
  ];
  for (const signature of functions) {
    assert.match(
      migration,
      new RegExp('ALTER\\s+FUNCTION\\s+public\\.' + signature.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + "\\s+SET\\s+search_path\\s+TO\\s+''", 'i'),
    );
  }
});
