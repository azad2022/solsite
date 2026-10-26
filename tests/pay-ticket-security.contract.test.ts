import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('all ticket read and mutation routes invoke centralized rate limiting', () => {
  const collection = source('../functions/api/pay/v1/tickets.ts');
  const detail = source('../functions/api/pay/v1/tickets/[ticketId].ts');
  const messages = source('../functions/api/pay/v1/tickets/[ticketId]/messages.ts');
  const moderation = source('../functions/api/pay/v1/tickets/[ticketId]/moderation.ts');
  const blockedUsers = source('../functions/api/pay/v1/ticket-blocks.ts');
  assert.ok(collection.includes("'list', 60, 60, 120"));
  assert.ok(collection.includes("'create', 60, 5, 20"));
  assert.ok(detail.includes("'detail', 60, 120, 240"));
  assert.ok(detail.includes("'status', 60, 10, 30"));
  assert.ok(detail.includes("'delete', 60, 10, 20"));
  assert.ok(messages.includes("'reply', 60, 10, 30"));
  assert.ok(moderation.includes('enforceTicketRateLimit'));
  assert.ok(blockedUsers.includes('blocked-users-read'));
  assert.ok(blockedUsers.includes('blocked-users-mutation'));
  const helper = source('../functions/api/pay/_shared/ticketSecurity.ts');
  assert.ok(helper.includes('CF-Connecting-IP'));
  assert.ok(helper.includes('hashCanonicalRequest({ clientIp })'));
  assert.ok(helper.includes('requireTicketJson'));
  assert.ok(helper.includes('application/json'));
});

test('ticket message bodies render as text, not injected HTML', () => {
  const component = source('../src/pay/components/PayTicketCenter.tsx');
  assert.ok(component.includes('<p>{item.body}</p>'));
  assert.equal(component.includes('dangerouslySetInnerHTML'), false);
});

test('soft-deleted tickets are hidden from normal list/detail/message API reads', () => {
  const collection = source('../functions/api/pay/v1/tickets.ts');
  const detail = source('../functions/api/pay/v1/tickets/[ticketId].ts');
  const messages = source('../functions/api/pay/v1/tickets/[ticketId]/messages.ts');
  assert.ok(collection.includes("params.set('deleted_at', 'is.null')"));
  assert.ok(detail.includes('&deleted_at=is.null&limit=1'));
  assert.ok(messages.includes('&deleted_at=is.null&limit=1'));
});
