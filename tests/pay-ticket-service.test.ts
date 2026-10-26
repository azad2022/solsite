import assert from 'node:assert/strict';
import test from 'node:test';
import { blockPayTicketUser, createPayTicket, deletePayTicket, getPayTicket, getPayTicketModeration, listPayTickets, replyToPayTicket, unblockPayTicketUser, updatePayTicketStatus } from '../src/pay/services/ticketService';
import type { PayHttpClient } from '../src/pay/http';

function clientFor(payload: unknown): PayHttpClient {
  return { request: async <T>() => payload as T } as unknown as PayHttpClient;
}

test('ticket service rejects malformed list envelopes', async () => {
  await assert.rejects(() => listPayTickets({ merchantId: 'm' }, clientFor({ tickets: {} })), /Invalid ticket list response/);
});

test('ticket service accepts the released ticket status values', async () => {
  const ticket = { id:'11111111-1111-4111-8111-111111111111', merchantId:'22222222-2222-4222-8222-222222222222', createdByUserId:'u1', subject:'Payment issue', status:'pending_admin', priority:'normal', createdAt:'2026-09-11T00:00:00.000Z', updatedAt:'2026-09-11T00:00:00.000Z', closedAt:null };
  const parsed = await updatePayTicketStatus(ticket.id,'pending_admin',clientFor({ ticket }));
  assert.equal(parsed.status,'pending_admin');
});

test('ticket service parses detail messages without transforming body content', async () => {
  const ticket = { id:'11111111-1111-4111-8111-111111111111', merchantId:'22222222-2222-4222-8222-222222222222', createdByUserId:'u1', subject:'Payment issue', status:'open', priority:'high', createdAt:'2026-09-11T00:00:00.000Z', updatedAt:'2026-09-11T00:00:00.000Z', closedAt:null };
  const message = { id:'33333333-3333-4333-8333-333333333333', ticketId:ticket.id, authorUserId:'u1', body:'Line 1\nLine 2', createdAt:'2026-09-11T00:01:00.000Z' };
  const detail = await getPayTicket(ticket.id,clientFor({ ticket, messages:[message] }));
  assert.equal(detail.ticket.id,ticket.id);
  assert.equal(detail.messages[0].body,'Line 1\nLine 2');
});

test('ticket service sends the real ticket mutation envelopes', async () => {
  const ticket = { id:'11111111-1111-4111-8111-111111111111', merchantId:'22222222-2222-4222-8222-222222222222', createdByUserId:'u1', subject:'Payment issue', status:'open', priority:'normal', createdAt:'2026-09-11T00:00:00.000Z', updatedAt:'2026-09-11T00:00:00.000Z', closedAt:null };
  const message = { id:'33333333-3333-4333-8333-333333333333', ticketId:ticket.id, authorUserId:'u1', body:'Hello', createdAt:'2026-09-11T00:01:00.000Z' };
  assert.equal((await createPayTicket({ merchantId:ticket.merchantId, subject:'Payment issue', message:'Hello' }, clientFor({ ticket }))).id,ticket.id);
  assert.equal((await replyToPayTicket(ticket.id,'Hello',clientFor({ message }))).id,message.id);
});


test('ticket moderation service validates block and unblock response envelopes', async () => {
  const blocked = await getPayTicketModeration('ticket-1', clientFor({ isBlocked: true, reason: 'Abuse', blockedAt: '2026-10-26T00:00:00.000Z' }));
  assert.equal(blocked.isBlocked, true);
  assert.equal(blocked.reason, 'Abuse');
  const created = await blockPayTicketUser('ticket-1', 'Abuse', clientFor({ isBlocked: true, reason: 'Abuse', blockedAt: '2026-10-26T00:00:00.000Z' }));
  assert.equal(created.isBlocked, true);
  const removed = await unblockPayTicketUser('ticket-1', clientFor({ isBlocked: false, reason: null, blockedAt: null, changed: true }));
  assert.equal(removed.isBlocked, false);
});

test('ticket deletion service requires the soft-delete confirmation envelope', async () => {
  await deletePayTicket('ticket-1', clientFor({ deleted: true, ticketId: 'ticket-1' }));
  await assert.rejects(() => deletePayTicket('ticket-1', clientFor({ deleted: false, ticketId: 'ticket-1' })), /Invalid ticket deletion response/);
});
