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


test('ticket operational migration keeps categories constrained and Payment Intent links tenant-bound', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migrations/20261016160000_solmint_pay_ticket_operational_fields.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /category text not null default 'other'/i);
  assert.match(migration, /foreign key \(payment_intent_id, merchant_id\)[\s\S]*references public\.pay_payment_intents\(id, merchant_id\)[\s\S]*on delete restrict/i);
  assert.match(migration, /i\.merchant_id = p_merchant_id/i);
  assert.match(migration, /INVALID_CATEGORY/);
  assert.match(migration, /PAYMENT_INTENT_NOT_FOUND/);
  assert.match(migration, /grant execute on function public\.pay_create_ticket\(text,uuid,text,text,text,text,uuid\)\s+to service_role/i);
  assert.doesNotMatch(migration, /grant execute on function public\.pay_create_ticket\([^;]+\)\s+to authenticated/i);
});

test('ticket security suite covers cross-merchant intent links, writes, and closed replies', () => {
  const security = fs.readFileSync(
    new URL('../supabase/tests/pay_ticket_security.sql', import.meta.url),
    'utf8',
  );
  assert.match(security, /Cross-merchant Payment Intent association was accepted/);
  assert.match(security, /Cross-merchant ticket reply was accepted/);
  assert.match(security, /Reply to closed ticket was accepted/);
  assert.match(security, /Merchant A must see only its own tickets/);
});
