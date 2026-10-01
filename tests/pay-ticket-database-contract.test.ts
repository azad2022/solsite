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
