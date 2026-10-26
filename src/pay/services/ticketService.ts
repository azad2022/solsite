import { defaultPayHttpClient, type PayHttpClient } from '../http';

export type PayTicketStatus = 'open' | 'pending_customer' | 'pending_admin' | 'resolved' | 'closed';
export type PayTicketPriority = 'normal' | 'high' | 'urgent';

export interface PayTicket {
  id: string;
  merchantId: string;
  createdByUserId: string;
  subject: string;
  status: PayTicketStatus;
  priority: PayTicketPriority;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface PayTicketMessage {
  id: string;
  ticketId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
}

export interface PayTicketDetail { ticket: PayTicket; messages: PayTicketMessage[]; }

export interface PayTicketModeration { isBlocked: boolean; reason: string | null; blockedAt: string | null; }

export interface PayTicketBlockedUser { userId: string; blockedByUserId: string; reason: string; blockedAt: string; }

interface TicketListEnvelope { tickets?: unknown; }
interface TicketDetailEnvelope { ticket?: unknown; messages?: unknown; }
interface TicketMutationEnvelope { ticket?: unknown; message?: unknown; deleted?: unknown; ticketId?: unknown; }
interface TicketModerationEnvelope { isBlocked?: unknown; reason?: unknown; blockedAt?: unknown; changed?: unknown; }
interface TicketBlockedUserListEnvelope { blockedUsers?: unknown; }

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(message);
  return value as Record<string, unknown>;
}

function stringValue(row: Record<string, unknown>, key: string): string {
  if (typeof row[key] !== 'string' || !row[key]) throw new TypeError(`Invalid ticket field: ${key}`);
  return row[key] as string;
}

function nullableString(row: Record<string, unknown>, key: string): string | null {
  if (row[key] === null) return null;
  return stringValue(row, key);
}

function parseTicket(value: unknown): PayTicket {
  const row = record(value, 'Invalid ticket response.');
  const status = stringValue(row, 'status');
  const priority = stringValue(row, 'priority');
  if (!['open','pending_customer','pending_admin','resolved','closed'].includes(status) || !['normal','high','urgent'].includes(priority)) throw new TypeError('Invalid ticket state.');
  return {
    id: stringValue(row, 'id'), merchantId: stringValue(row, 'merchantId'), createdByUserId: stringValue(row, 'createdByUserId'),
    subject: stringValue(row, 'subject'), status: status as PayTicketStatus, priority: priority as PayTicketPriority,
    createdAt: stringValue(row, 'createdAt'), updatedAt: stringValue(row, 'updatedAt'), closedAt: nullableString(row, 'closedAt'),
  };
}

function parseMessage(value: unknown): PayTicketMessage {
  const row = record(value, 'Invalid ticket message response.');
  return { id: stringValue(row,'id'), ticketId: stringValue(row,'ticketId'), authorUserId: stringValue(row,'authorUserId'), body: stringValue(row,'body'), createdAt: stringValue(row,'createdAt') };
}

function encode(value: string): string { return encodeURIComponent(value); }

export async function listPayTickets(input: { merchantId?: string | null; status?: PayTicketStatus | null }, client: PayHttpClient = defaultPayHttpClient): Promise<PayTicket[]> {
  const params = new URLSearchParams();
  if (input.merchantId) params.set('merchantId', input.merchantId);
  if (input.status) params.set('status', input.status);
  const suffix = params.toString();
  const payload = await client.request<TicketListEnvelope>(`/api/pay/v1/tickets${suffix ? `?${suffix}` : ''}`);
  if (!Array.isArray(payload.tickets)) throw new TypeError('Invalid ticket list response.');
  return payload.tickets.map(parseTicket);
}

export async function getPayTicket(ticketId: string, client: PayHttpClient = defaultPayHttpClient): Promise<PayTicketDetail> {
  const payload = await client.request<TicketDetailEnvelope>(`/api/pay/v1/tickets/${encode(ticketId)}`);
  if (!payload.ticket || !Array.isArray(payload.messages)) throw new TypeError('Invalid ticket detail response.');
  return { ticket: parseTicket(payload.ticket), messages: payload.messages.map(parseMessage) };
}

export async function createPayTicket(input: { merchantId: string; subject: string; message: string; priority?: PayTicketPriority }, client: PayHttpClient = defaultPayHttpClient): Promise<PayTicket> {
  const payload = await client.request<TicketMutationEnvelope>('/api/pay/v1/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ merchantId: input.merchantId, subject: input.subject.trim(), message: input.message.trim(), priority: input.priority || 'normal' }) });
  if (!payload.ticket) throw new TypeError('Invalid ticket creation response.');
  return parseTicket(payload.ticket);
}

export async function replyToPayTicket(ticketId: string, message: string, client: PayHttpClient = defaultPayHttpClient): Promise<PayTicketMessage> {
  const payload = await client.request<TicketMutationEnvelope>(`/api/pay/v1/tickets/${encode(ticketId)}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: message.trim() }) });
  if (!payload.message) throw new TypeError('Invalid ticket reply response.');
  return parseMessage(payload.message);
}

export async function updatePayTicketStatus(ticketId: string, status: PayTicketStatus, client: PayHttpClient = defaultPayHttpClient): Promise<PayTicket> {
  const payload = await client.request<TicketMutationEnvelope>(`/api/pay/v1/tickets/${encode(ticketId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  if (!payload.ticket) throw new TypeError('Invalid ticket status response.');
  return parseTicket(payload.ticket);
}


function parseModeration(value: unknown): PayTicketModeration {
  const row = record(value, 'Invalid ticket moderation response.');
  if (typeof row.isBlocked !== 'boolean') throw new TypeError('Invalid ticket moderation response.');
  const reason = row.reason === null ? null : typeof row.reason === 'string' ? row.reason : null;
  const blockedAt = row.blockedAt === null ? null : typeof row.blockedAt === 'string' ? row.blockedAt : null;
  return { isBlocked: row.isBlocked, reason, blockedAt };
}

export async function getPayTicketModeration(ticketId: string, client: PayHttpClient = defaultPayHttpClient): Promise<PayTicketModeration> {
  const payload = await client.request<TicketModerationEnvelope>(`/api/pay/v1/tickets/${encode(ticketId)}/moderation`);
  return parseModeration(payload);
}

export async function blockPayTicketUser(ticketId: string, reason: string, client: PayHttpClient = defaultPayHttpClient): Promise<PayTicketModeration> {
  const payload = await client.request<TicketModerationEnvelope>(`/api/pay/v1/tickets/${encode(ticketId)}/moderation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason.trim() }),
  });
  return parseModeration(payload);
}

export async function unblockPayTicketUser(ticketId: string, client: PayHttpClient = defaultPayHttpClient): Promise<PayTicketModeration> {
  const payload = await client.request<TicketModerationEnvelope>(`/api/pay/v1/tickets/${encode(ticketId)}/moderation`, { method: 'DELETE' });
  return parseModeration(payload);
}

export async function deletePayTicket(ticketId: string, client: PayHttpClient = defaultPayHttpClient): Promise<void> {
  const payload = await client.request<TicketMutationEnvelope>(`/api/pay/v1/tickets/${encode(ticketId)}`, { method: 'DELETE' });
  if (payload.deleted !== true || payload.ticketId !== ticketId) throw new TypeError('Invalid ticket deletion response.');
}


function parseBlockedUser(value: unknown): PayTicketBlockedUser {
  const row = record(value, 'Invalid blocked-user response.');
  return {
    userId: stringValue(row, 'userId'),
    blockedByUserId: stringValue(row, 'blockedByUserId'),
    reason: stringValue(row, 'reason'),
    blockedAt: stringValue(row, 'blockedAt'),
  };
}

export async function listPayTicketUserBlocks(client: PayHttpClient = defaultPayHttpClient): Promise<PayTicketBlockedUser[]> {
  const payload = await client.request<TicketBlockedUserListEnvelope>('/api/pay/v1/ticket-blocks');
  if (!Array.isArray(payload.blockedUsers)) throw new TypeError('Invalid blocked-user list response.');
  return payload.blockedUsers.map(parseBlockedUser);
}

export async function unblockPayTicketUserById(userId: string, client: PayHttpClient = defaultPayHttpClient): Promise<boolean> {
  const payload = await client.request<{ userId?: unknown; isBlocked?: unknown; changed?: unknown }>('/api/pay/v1/ticket-blocks', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (payload.userId !== userId || payload.isBlocked !== false || typeof payload.changed !== 'boolean') {
    throw new TypeError('Invalid blocked-user update response.');
  }
  return payload.changed;
}
