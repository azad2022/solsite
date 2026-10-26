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
