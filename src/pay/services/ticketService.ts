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

interface TicketListEnvelope { tickets?: unknown; }
interface TicketDetailEnvelope { ticket?: unknown; messages?: unknown; }
interface TicketMutationEnvelope { ticket?: unknown; message?: unknown; }

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
